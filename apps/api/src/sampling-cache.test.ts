import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {createClient} from 'redis';
import Fastify from 'fastify';
import {SamplingCache,collectSource,diffHash,SAMPLING_REFRESH_MS,stableJson,type Sources} from './sampling-cache.js';
import {validateSamplingRecord} from './sampling-validity.js';
import {SamplingWorker} from './sampling-worker.js';
import {registerCreatorSamplingRoutes,type SamplingData} from './creator-sampling.js';

const row=(id:string,quantity=1)=>({id,date:'2026-10-06',creator:'creator-'+id,level:'L2',product:'商品',category:'盲盒',quantity,shipped:true,fulfilled:true,productId:'p1',chinaPrice:100,unitCostRmb:40,costEstimated:false,costStatus:'matched' as const});
const data=(records=[row('r1'),row('r2')]):SamplingData=>({records,quality:[],fulfillmentAvailable:true,source:{fetchedAt:'2026-11-09T06:00:00Z',range:{from:'2026-10-01',to:'2026-11-01'},hasMore:false,categoryOptions:['盲盒'],secondaryRows:2,filenameRows:0,secondaryNames:['10月达人跟进表'],mode:'automatic',months:['2026-10'],secondaryCount:1,costRate:.4,costCurrency:'RMB'}});
const sources=(rows:unknown[][]=[['r1',1],['r2',1]]):Sources=>{
 const result:Sources={rows:{},tables:{}};
 collectSource(result,'primary:source:2026-10',{name:'一类表',columns:['记录','数量'],recordIds:rows.map(row=>String(row[0])),rows,complete:true});return result;
};
const logger={info:vi.fn(),error:vi.fn()};

describe('sampling cache comparison',()=>{
 it('compares rows first and only includes added, modified and deleted fields',()=>{
  expect(diffHash({a:'same',b:'old',c:'removed'},{a:'same',b:'new',d:'added'})).toEqual({set:{b:'new',d:'added'},remove:['c'],added:1,updated:1,deleted:1});
  expect(diffHash({a:'same'},{a:'same'})).toEqual({set:{},remove:[],added:0,updated:0,deleted:0});
  expect(stableJson({b:2,a:{d:4,c:3}})).toBe(stableJson({a:{c:3,d:4},b:2}));
 });
 it('keeps source IDs stable when Base record order changes and rejects incomplete/duplicate snapshots',()=>{
  expect(sources([['r2',1],['r1',1]]).rows).toEqual(sources().rows);
  expect(()=>collectSource({rows:{},tables:{}},'test',{name:'test',columns:[],rows:[],complete:false})).toThrow('未完整');
  expect(()=>sources([['r1',1],['r1',2]])).toThrow('重复');
 });
 it('runs the backend scheduler every ten minutes and stops it on shutdown',async()=>{
  vi.useFakeTimers();
  try{
   const owners=vi.fn(async()=>[]);
   const worker=new SamplingWorker({} as SamplingCache,{read:vi.fn()},owners,logger);
   worker.start();await vi.advanceTimersByTimeAsync(0);expect(owners).toHaveBeenCalledTimes(1);
   await vi.advanceTimersByTimeAsync(SAMPLING_REFRESH_MS-1);expect(owners).toHaveBeenCalledTimes(1);
   await vi.advanceTimersByTimeAsync(1);expect(owners).toHaveBeenCalledTimes(2);
   await worker.stop();await vi.advanceTimersByTimeAsync(SAMPLING_REFRESH_MS);expect(owners).toHaveBeenCalledTimes(2);
  }finally{vi.useRealTimers()}
 });
});

describe.skipIf(!process.env.REDIS_TEST_URL)('real Redis sampling cache',()=>{
 const client=createClient({url:process.env.REDIS_TEST_URL,disableOfflineQueue:true,socket:{reconnectStrategy:()=>false}});
 const commands:string[][]=[];
 const namespace='profit:test:sampling:'+randomUUID();
 let time=new Date('2026-11-09T06:00:00Z');
 const cache=new SamplingCache({async sendCommand(args){commands.push(args);return client.sendCommand(args)}},()=>time,namespace);
 const owners=new Set<string>();
 async function publish(owner:string,value=data(),raw=sources()){
  owners.add(owner);const token=await cache.acquire(owner);expect(token).not.toBeNull();
  try{return await cache.publish(owner,token!,value,raw)}finally{await cache.release(owner,token!)}
 }
 beforeAll(async()=>{client.on('error',()=>{});await client.connect()});
 afterAll(async()=>{for(const owner of owners)await client.del(Object.values(cache.keys(owner)));await client.close()});
 it('initializes once, then performs zero record writes on unchanged data',async()=>{
  const owner='unchanged';await publish(owner);
  const before=await cache.read(owner);time=new Date('2026-11-09T06:10:00Z');commands.length=0;
  const delta=await publish(owner);
  expect(delta.records).toEqual({added:0,updated:0,deleted:0});expect(delta.sourceRows).toEqual({added:0,updated:0,deleted:0});
  const commit=commands.find(args=>args[0]==='EVAL'&&args[2]==='5')!;
  const patches=JSON.parse(commit.at(-1)!);expect(patches.slice(1).every((patch:ReturnType<typeof diffHash>)=>Object.keys(patch.set).length===0&&patch.remove.length===0)).toBe(true);
  const after=await cache.read(owner);
  expect(after.cache.lastChangedAt).toBe(before.cache.lastChangedAt);expect(after.cache.lastCheckedAt).toBe(time.toISOString());
 });
 it('updates just one changed row and handles additions and deletions without rewriting unchanged rows',async()=>{
  const owner='changes';await publish(owner);commands.length=0;
  const delta=await publish(owner,data([row('r1',7),row('r2'),row('r3')]),sources([['r1',7],['r2',1],['r3',1]]));
  expect(delta.records).toEqual({added:1,updated:1,deleted:0});expect(delta.sourceRows).toEqual({added:1,updated:1,deleted:0});
  const patches=JSON.parse(commands.find(args=>args[0]==='EVAL'&&args[2]==='5')!.at(-1)!);
  expect(Object.keys(patches[1].set)).toEqual(['r1','r3']);expect(patches[1].set.r2).toBeUndefined();
  const deleted=await publish(owner,data([row('r2'),row('r3')]),sources([['r2',1],['r3',1]]));
  expect(deleted.records).toEqual({added:0,updated:0,deleted:1});
  const result=await cache.read(owner);expect('records' in result&&result.records.map(row=>row.id)).toEqual(['r2','r3']);
 });
 it('updates only the invalid row when its required information is repaired',async()=>{
  const owner='invalid-repair';
  const invalid=validateSamplingRecord({...row('r1'),creator:''});
  await publish(owner,data([invalid,row('r2')]));
  const before=await cache.read(owner);expect('records' in before&&before.records[0].invalidReasons).toContain('缺少达人账号');
  commands.length=0;
  const delta=await publish(owner,data([validateSamplingRecord(row('r1')),row('r2')]));
  expect(delta.records).toEqual({added:0,updated:1,deleted:0});
  const patches=JSON.parse(commands.find(args=>args[0]==='EVAL'&&args[2]==='5')!.at(-1)!);
  expect(Object.keys(patches[1].set)).toEqual(['r1']);
  const after=await cache.read(owner);expect('records' in after&&after.records[0].invalidReasons).toEqual([]);
 });
 it('keeps owners isolated and prevents stale workers from writing after logout',async()=>{
  owners.add('isolated-a');owners.add('isolated-b');
  await publish('isolated-a',data([row('private-a')]));
  expect((await cache.read('isolated-b')).cache.ready).toBe(false);
  const token=await cache.acquire('isolated-a');expect(await cache.acquire('isolated-a')).toBeNull();
  await cache.deactivate('isolated-a');
  await expect(cache.publish('isolated-a',token!,data(),sources())).rejects.toThrow('锁已失效');
  await expect(cache.read('isolated-a')).rejects.toMatchObject({statusCode:401});
  expect(await cache.acquire('isolated-a')).toBeNull();await cache.activate('isolated-a');
  const result=await cache.read('isolated-a');expect('records' in result&&result.records[0].id).toBe('private-a');
 });
 it('removes sources that leave the selected months without rewriting retained month rows',async()=>{
  const owner='month-change',previous=sources([['r2',1]]);
  collectSource(previous,'primary:source:2026-08',{name:'一类表',columns:['记录','数量'],recordIds:['r1'],rows:[['r1',1]],complete:true});
  await publish(owner,data([row('r1'),row('r2')]),previous);commands.length=0;
  const next=sources([['r2',1]]);
  collectSource(next,'primary:source:2026-11',{name:'一类表',columns:['记录','数量'],recordIds:['r3'],rows:[['r3',1]],complete:true});
  const delta=await publish(owner,data([row('r2'),row('r3')]),next);
  expect(delta.records).toEqual({added:1,updated:0,deleted:1});
  expect(delta.sourceRows).toEqual({added:1,updated:0,deleted:1});
  expect(delta.sourceTables).toEqual({added:1,updated:0,deleted:1});
  const patches=JSON.parse(commands.find(args=>args[0]==='EVAL'&&args[2]==='5')!.at(-1)!);
  expect(Object.keys(patches[2].set)).toEqual(['primary:source:2026-11:r3']);
  expect(patches[2].remove).toEqual(['primary:source:2026-08:r1']);
  expect((await client.hGetAll(cache.keys(owner).rows))['primary:source:2026-10:r2']).toBe(stableJson(['r2',1]));
 });
 it('serves ready dashboard data from Redis without any Feishu read or catalog query',async()=>{
  const owner='fast-path';await publish(owner);
  const scanner={read:vi.fn()},worker=new SamplingWorker(cache,scanner,async()=>[],logger);
  const app=Fastify();registerCreatorSamplingRoutes(app,'/api/profit',async()=>owner,{sources:async()=>({tables:[]}),read:(owner,input)=>worker.read(owner,input)},owner=>worker.request(owner));
  try{
   for(const url of ['/api/profit/creator-sampling/data','/api/profit/creator-sampling/read']){
    const response=await app.inject({method:url.endsWith('/read')?'POST':'GET',url,...(url.endsWith('/read')?{payload:{}}:{})});
    expect(response.statusCode).toBe(200);expect(response.json().records).toHaveLength(2);expect(response.json().cache.ready).toBe(true);
   }
   expect(scanner.read).not.toHaveBeenCalled();
  }finally{await app.close();await worker.stop()}
 });
 it('retains the complete old cache when a remote table fails or is incomplete',async()=>{
  const owner='failed-scan';await publish(owner);const before=await cache.read(owner);
  const scanner={read:vi.fn(async()=>{throw Error('飞书表格未完整读取')})},worker=new SamplingWorker(cache,scanner,async()=>[],logger);
  await expect(worker.refresh(owner)).rejects.toThrow('未完整');
  const after=await cache.read(owner);
  expect('records' in after&&'records' in before&&after.records).toEqual('records' in before&&before.records);
  expect(after.cache.lastCheckedAt).toBe(before.cache.lastCheckedAt);expect(after.cache.error).toContain('未完整');
  expect(await cache.acquire(owner)).not.toBeNull();await client.del(cache.keys(owner).lock);await worker.stop();
 });
 it('initializes in the background and does not let an empty-cache request wait for the remote scan',async()=>{
  const owner='cold-cache';owners.add(owner);
  let finish!:(value:SamplingData)=>void;
  const scanner={read:vi.fn(()=>new Promise<SamplingData>(resolve=>{finish=resolve}))},worker=new SamplingWorker(cache,scanner,async()=>[],logger);
  const first=await worker.read(owner);expect(first.cache.ready).toBe(false);
  await new Promise<void>(resolve=>setImmediate(resolve));
  await vi.waitFor(()=>expect(scanner.read).toHaveBeenCalledTimes(1));
  const another=await worker.read(owner);expect(another.cache.ready).toBe(false);expect(scanner.read).toHaveBeenCalledTimes(1);
  finish(data());await vi.waitFor(async()=>expect((await cache.read(owner)).cache.ready).toBe(true));await worker.stop();
 });
});
