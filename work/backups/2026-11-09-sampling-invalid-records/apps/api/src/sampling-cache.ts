import {createHash,randomUUID} from 'node:crypto';
import type {ReadTable} from './feishu.js';
import type {SamplingData} from './creator-sampling.js';

export const SAMPLING_REFRESH_MS=10*60_000;
export type RedisPort={sendCommand(args:string[]):Promise<unknown>};
type Hash=Record<string,string>;
export type Patch={set:Hash;remove:string[];added:number;updated:number;deleted:number};
export type Sources={rows:Hash;tables:Hash};
const failure=(text:string)=>Object.assign(Error(text),{statusCode:503});
export function stableJson(value:unknown):string{
 return JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
}
export function diffHash(before:Hash,after:Hash):Patch{
 const patch:Patch={set:{},remove:[],added:0,updated:0,deleted:0};
 for(const [key,value] of Object.entries(after))if(before[key]!==value){patch.set[key]=value;if(Object.hasOwn(before,key))patch.updated++;else patch.added++}
 for(const key of Object.keys(before))if(!Object.hasOwn(after,key)){patch.remove.push(key);patch.deleted++}
 return patch;
}
function hash(value:unknown):Hash{
 if(!Array.isArray(value))return (value||{}) as Hash;
 const result:Hash={};for(let i=0;i<value.length;i+=2)result[String(value[i])]=String(value[i+1]);return result;
}
export function collectSource(sources:Sources,key:string,table:ReadTable){
 if(!table.complete)throw Object.assign(Error('表格未完整读取，保留上次成功缓存。'),{statusCode:422});
 sources.tables[key]=stableJson({name:table.name,documentName:table.documentName||'',columns:table.columns});
 const ids=table.recordIds?.length===table.rows.length?table.recordIds:null;
 const seen=new Set<string>();
 table.rows.forEach((row,index)=>{
  const id=key+':'+(ids?.[index]||'row-'+index);
  if(seen.has(id))throw Error('表格存在重复记录标识，保留上次成功缓存。');
  seen.add(id);sources.rows[id]=stableJson(row);
 });
}
const readScript=`return {redis.call('HGETALL',KEYS[1]),redis.call('HGETALL',KEYS[2]),redis.call('EXISTS',KEYS[3])}`;
const commitScript=`
if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
local patches=cjson.decode(ARGV[2])
for i,patch in ipairs(patches) do
 for field,value in pairs(patch.set) do redis.call('HSET',KEYS[i+1],field,value) end
 for _,field in ipairs(patch.remove) do redis.call('HDEL',KEYS[i+1],field) end
end
return 1`;
const tokenScript=(command:string)=>`if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('${command}',KEYS[1]${command==='PEXPIRE'?',ARGV[2]':''}) end return 0`;
const counters=(patch:Patch)=>({added:patch.added,updated:patch.updated,deleted:patch.deleted});
const changed=(patch:Patch)=>patch.added+patch.updated+patch.deleted>0;

/** Hash fields are individual source/dashboard rows. Never replace a whole-table JSON value. */
export class SamplingCache{
 constructor(private redis:RedisPort,private now=()=>new Date(),private namespace='profit:sampling:v1'){}
 keys(owner:string){
  const prefix=this.namespace+':{'+createHash('sha256').update(owner).digest('hex')+'}';
  return {meta:prefix+':meta',records:prefix+':records',rows:prefix+':source-rows',tables:prefix+':source-tables',lock:prefix+':lock'};
 }
 private async command(...args:string[]){try{return await this.redis.sendCommand(args)}catch{throw failure('Redis 缓存暂时不可用，请稍后重试。')}}
 async read(owner:string){
  const keys=this.keys(owner),result=await this.command('EVAL',readScript,'3',keys.meta,keys.records,keys.lock) as unknown[];
  const meta=hash(result[0]),rows=hash(result[1]);
  if(meta.enabled==='0')throw Object.assign(Error('请先连接自己的飞书账号。'),{statusCode:401});
  const checking=Number(result[2])>0;
  if(!meta.payload)return {ready:false as const,cache:{ready:false,checking,lastCheckedAt:null,lastChangedAt:null,error:meta.error||null,refreshIntervalSeconds:SAMPLING_REFRESH_MS/1000}};
  const payload=JSON.parse(meta.payload) as Omit<SamplingData,'records'>;
  const order=JSON.parse(meta.order) as string[];
  if(order.some(id=>!Object.hasOwn(rows,id)))throw failure('缓存校验未通过，请重新检查更新。');
  return {...payload,records:order.map(id=>JSON.parse(rows[id]) as SamplingData['records'][number]),source:{...payload.source,fetchedAt:meta.checkedAt},cache:{ready:true,checking,lastCheckedAt:meta.checkedAt,lastChangedAt:meta.changedAt,error:meta.error||null,delta:JSON.parse(meta.delta||'null'),refreshIntervalSeconds:SAMPLING_REFRESH_MS/1000}};
 }
 async activate(owner:string){
  const key=this.keys(owner).meta;
  return Number(await this.command('EVAL',`local enabled=redis.call('HGET',KEYS[1],'enabled'); if enabled~='1' then redis.call('HSET',KEYS[1],'enabled','1','error',''); return 1 end return 0`,'1',key))===1;
 }
 async deactivate(owner:string){
  const keys=this.keys(owner);
  await this.command('EVAL',`redis.call('HSET',KEYS[1],'enabled','0','error',''); redis.call('DEL',KEYS[2]); return 1`,'2',keys.meta,keys.lock);
 }
 async acquire(owner:string){
  const keys=this.keys(owner),token=randomUUID();
  const acquired=await this.command('EVAL',`if redis.call('HGET',KEYS[1],'enabled')=='0' then return 0 end local result=redis.call('SET',KEYS[2],ARGV[1],'NX','PX','90000'); if result then return 1 end return 0`,'2',keys.meta,keys.lock,token);
  return Number(acquired)===1?token:null;
 }
 async renew(owner:string,token:string){return Number(await this.command('EVAL',tokenScript('PEXPIRE'),'1',this.keys(owner).lock,token,'90000'))===1}
 async release(owner:string,token:string){await this.command('EVAL',tokenScript('DEL'),'1',this.keys(owner).lock,token)}
 async fail(owner:string,token:string,error:unknown){
  const keys=this.keys(owner),message=error instanceof Error?error.message:'后台核对失败';
  await this.command('EVAL',`if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end redis.call('HSET',KEYS[2],'error',ARGV[2],'attemptedAt',ARGV[3]); return 1`,'2',keys.lock,keys.meta,token,message.slice(0,300),this.now().toISOString());
 }
 async publish(owner:string,token:string,data:SamplingData,sources:Sources){
  const keys=this.keys(owner);
  const before=await this.command('EVAL',`return {redis.call('HGETALL',KEYS[1]),redis.call('HGETALL',KEYS[2]),redis.call('HGETALL',KEYS[3]),redis.call('HGETALL',KEYS[4])}`,'4',keys.meta,keys.records,keys.rows,keys.tables) as unknown[];
  const meta=hash(before[0]),records:Hash={};
  for(const row of data.records){if(Object.hasOwn(records,row.id))throw Error('看板记录标识重复，保留上次成功缓存。');records[row.id]=stableJson(row)}
  const {records:_,source,...rest}=data;
  const {fetchedAt:__,...sourceMetadata}=source;
  const payload=stableJson({...rest,source:sourceMetadata}),order=JSON.stringify(data.records.map(row=>row.id));
  const recordPatch=diffHash(hash(before[1]),records),rowPatch=diffHash(hash(before[2]),sources.rows),tablePatch=diffHash(hash(before[3]),sources.tables);
  const at=this.now().toISOString();
  const hasChanges=changed(recordPatch)||changed(rowPatch)||changed(tablePatch)||meta.payload!==payload||meta.order!==order;
  const delta={records:counters(recordPatch),sourceRows:counters(rowPatch),sourceTables:counters(tablePatch)};
  const nextMeta={...meta,enabled:'1',payload,order,checkedAt:at,changedAt:hasChanges?at:meta.changedAt,error:'',delta:JSON.stringify(delta)};
  const patches=[diffHash(meta,nextMeta),recordPatch,rowPatch,tablePatch];
  const saved=await this.command('EVAL',commitScript,'5',keys.lock,keys.meta,keys.records,keys.rows,keys.tables,token,JSON.stringify(patches));
  if(Number(saved)!==1)throw Error('后台同步锁已失效，本次数据未写入缓存。');
  return delta;
 }
}
