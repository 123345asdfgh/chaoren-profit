import {describe,it,expect} from 'vitest';
import {validateSamplingRecord} from './sampling-validity.js';
import {automaticSecondaryData,buildSamplingData} from './creator-sampling-core.js';
import {attachSamplingCosts} from './creator-sampling-costs.js';
const base={id:'1',date:'2026-10-21',creator:'alice',level:'L2',product:'商品',category:'盲盒',quantity:2,shipped:true,fulfilled:true,unitCostRmb:40,raw:{date:'2026-10-21',shipped:'是'}};
const range={from:'2026-10-01',to:'2026-11-01'};
describe('whole sampling row validation',()=>{
 it('rejects a row when any required metric field is unusable, including zero-price and zero-quantity boundary values',()=>{
  expect(validateSamplingRecord(base).invalidReasons).toEqual([]);
  expect(validateSamplingRecord({...base,category:''})).toMatchObject({invalidReasons:[],fulfilled:true});
  expect(validateSamplingRecord({...base,category:'  '})).toMatchObject({invalidReasons:[],fulfilled:true});
  for(const change of [{date:''},{creator:''},{level:''},{level:'L9'},{product:''},{category:'不明'},{quantity:null},{quantity:-1},{quantity:NaN},{raw:{date:base.date,shipped:''}},{raw:{date:base.date,shipped:'未知'}},{unitCostRmb:null}]){
   const record=validateSamplingRecord({...base,...change});
   expect(record.invalidReasons?.length).toBeGreaterThan(0);expect(record.fulfilled).toBe(false);
  }
  expect(validateSamplingRecord({...base,quantity:0,unitCostRmb:0}).invalidReasons).toEqual([]);
 });
 it('keeps explicit unshipped and normal unfulfilled records valid',()=>{
  for(const status of ['否','未邮寄','待寄样'])expect(validateSamplingRecord({...base,shipped:false,fulfilled:false,unitCostRmb:null,raw:{date:base.date,shipped:status}}).invalidReasons).toEqual([]);
  expect(validateSamplingRecord({...base,fulfilled:false}).invalidReasons).toEqual([]);
 });
 it('retains invalid dates and source IDs, ignores placeholders and recovers after source repair',()=>{
  const table={name:'主表',columns:['日期','达人名称','是否邮寄','寄样产品名称','寄样产品数量','品类','达人等级'],rows:[[base.date,null,null,null,null,null,null],['invalid','alice','是','商品',2,'盲盒','L2'],[base.date,'bob','是','商品',null,'盲盒','L2']],recordIds:['placeholder','bad-date','bad-quantity'],complete:true};
  const classified=()=>attachSamplingCosts(buildSamplingData(table,[],range).records,[{id:'p',name:'商品',chinaPrice:100}]).map(validateSamplingRecord);
  expect(classified().map(row=>row.id)).toEqual(['bad-date','bad-quantity']);
  expect(classified().map(row=>row.invalidReasons)).toEqual([['日期缺失或无效'],['数量缺失或无效']]);
  expect(classified()[0]).toMatchObject({sourceName:'主表',sourceRecordId:'bad-date',raw:{date:'invalid'}});
  table.rows[1][0]=base.date;table.rows[2][4]=2;
  expect(classified().every(row=>!row.invalidReasons?.length)).toBe(true);
 });
 it('keeps invalid rows scoped to the latest available months',()=>{
  const table=(documentName:string,rows:unknown[][])=>({name:'sheet',documentName,columns:['日期','Buyer Username','备注'],rows,complete:true});
  const result=automaticSecondaryData([table('2026年5月达人表',[['错误日期','old','直播']]),table('2026年10月达人表',[[21,'current','直播']])],new Date('2026-11-09T00:00:00Z'));
  expect(result.months).toEqual(['2026-05','2026-10']);
  const latest=automaticSecondaryData([table('2026年5月达人表',[['错误日期','old','直播']]),...['8','9','10'].map(month=>table(`2026年${month}月达人表`,[[21,'current','直播']]))],new Date('2026-11-09T00:00:00Z'));
  expect(latest.months).toEqual(['2026-08','2026-09','2026-10']);expect(latest.invalidRecords).toEqual([]);
 });
 it('keeps secondary failures visible and preserves original provenance after month filtering',()=>{
  const secondary={name:'sheet',documentName:'2026年10月达人表',sourceKey:'secondary:abc',columns:['日期','Buyer Username','备注'],rows:[[base.date,null,null],[21,'alice','直播'],[22,null,'直播'],['错误日期','bob','直播']],recordIds:['blank','good','missing-account','bad-date'],complete:true};
  const prepared=automaticSecondaryData([secondary],new Date('2026-11-09T00:00:00Z'));
  expect(prepared.tables[0].recordIds).toEqual(['good','missing-account']);
  expect(prepared.invalidRecords[0]).toMatchObject({sourceRecordId:'bad-date',sourceRow:4,invalidReasons:['日期缺失或无效']});
  const primary={name:'主表',columns:['日期','达人名称','是否邮寄','寄样产品名称','寄样产品数量','品类','达人等级'],rows:[[base.date,'alice','是','商品',1,'盲盒','L2']],complete:true};
  const data=buildSamplingData(primary,prepared.tables,range);
  expect(data.records[0].fulfilled).toBe(true);
  expect(data.records[1]).toMatchObject({sourceType:'secondary',sourceRecordId:'missing-account',sourceRow:3,invalidReasons:['缺少达人账号']});
 });
});
