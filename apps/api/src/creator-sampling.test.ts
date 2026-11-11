import {describe,it,expect,vi} from 'vitest';
import {CreatorSampling} from './creator-sampling.js';
import type {SavedFeishuTables} from './feishu-saved-tables.js';
import type {ReadOptions,ReadTable} from './feishu.js';
const now=()=>new Date('2026-11-06T08:00:00Z');
const primary:ReadTable={name:'主表',columns:['日期','达人名称','是否邮寄','寄样产品名称','寄样产品数量','品类','达人等级'],rows:[],complete:true};
function setup(months:string[]){
 const list=vi.fn(async(owner:string)=>({tables:[{id:owner+'-primary',sourceType:'primary'},...months.map((month,i)=>({id:owner+'-'+i,sourceType:'secondary',documentName:month+'达人跟进表'}))]}));
 const read=vi.fn(async(owner:string,id:string,options?:ReadOptions):Promise<ReadTable>=>{
  expect(id.startsWith(owner+'-')).toBe(true);
  if(id.endsWith('-primary'))return {...primary,rows:[[options!.dateRange!.from,'alice','是','商品',1,'盲盒','L2']]};
  return {name:'sheet1',documentName:months[Number(id.split('-').at(-1))]+'达人跟进表',columns:['日期','Buyer Username','备注'],rows:[[1,'alice','直播']],complete:true};
 });
 const store={list,read} as unknown as Pick<SavedFeishuTables,'list'|'read'>;
 return {service:new CreatorSampling(store,now,async()=>[{id:'product-1',name:'商品',chinaPrice:100}]),list,read};
}
describe('automatic creator sampling reads',()=>{
 it('requests primary data only for the latest three available months, including gaps',async()=>{
  const {service,read}=setup(['2026年5月','2026年7月','2026年9月','2026年10月','2026年10月']);
  const data=await service.read('ownerA',{});
  expect(data.source).toMatchObject({mode:'automatic',months:['2026-07','2026-09','2026-10'],secondaryCount:4});
  const mainCalls=read.mock.calls.filter(call=>call[1].endsWith('-primary'));
  expect(mainCalls.map(call=>call[2]?.dateRange)).toEqual([
   {field:'日期',from:'2026-07-01',to:'2026-08-01'},
   {field:'日期',from:'2026-09-01',to:'2026-10-01'},
   {field:'日期',from:'2026-10-01',to:'2026-11-01'}
  ]);
  expect(data.records).toHaveLength(3);expect(data.records.every(r=>r.fulfilled)).toBe(true);
 });
 it('automatically uses more than three sheets when they belong to the same month',async()=>{
  const {service}=setup(Array(5).fill('2026年10月'));
  expect((await service.read('ownerA')).source).toMatchObject({months:['2026-10'],secondaryCount:5});
 });
 it('does not read primary data when there are no usable secondary months',async()=>{
  const {service,read}=setup([]);const data=await service.read('ownerB');
  expect(data.records).toEqual([]);expect(data.source.range).toBeNull();expect(read).not.toHaveBeenCalled();
 });
 it('scopes all automatic reads to the requesting owner and rejects legacy manual selections',async()=>{
  const {service,list,read}=setup(['2026年10月']);
  await service.read('ownerA');await service.read('ownerB');
  expect(list.mock.calls.map(call=>call[0])).toEqual(['ownerA','ownerB']);
  expect(read.mock.calls.filter(call=>call[0]==='ownerB').every(call=>call[1].startsWith('ownerB-'))).toBe(true);
  await expect(service.read('ownerA',{tableIds:['other-owner-id']})).rejects.toThrow();
 });
 it('releases the busy lock after a failed read and rejects incomplete primary data',async()=>{
  const {service,read}=setup(['2026年10月']);
  const original=read.getMockImplementation()!;
  read.mockImplementation(async(owner,id,options)=>id.endsWith('-primary')?{...primary,complete:false}:original(owner,id,options));
  await expect(service.read('ownerA')).rejects.toThrow('未完整读取');
  read.mockImplementation(original);expect((await service.read('ownerA')).records).toHaveLength(1);
 });
 it('loads catalog prices again on each read without changing the fulfillment calculation',async()=>{
  const {list,read}=setup(['2026年10月']);
  let chinaPrice='100';
  const costs=vi.fn(async()=>[{id:'product-1',name:'商品',chinaPrice}]);
  const service=new CreatorSampling({list,read} as unknown as Pick<SavedFeishuTables,'list'|'read'>,now,costs);
  const first=await service.read('ownerA');
  expect(first.records[0]).toMatchObject({productId:'product-1',unitCostRmb:40,fulfilled:true});
  chinaPrice='150';const next=await service.read('ownerA');
  expect(next.records[0]).toMatchObject({unitCostRmb:60,fulfilled:true});
  expect(costs).toHaveBeenCalledTimes(2);expect(costs).toHaveBeenCalledWith(['商品']);
 });

});
