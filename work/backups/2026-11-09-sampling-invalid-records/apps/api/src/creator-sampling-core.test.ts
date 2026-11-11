import {describe,it,expect} from 'vitest';
import {accountKey,automaticSecondaryData,buildSamplingData,calendarRange,filenameMonth,isFulfilled,isShipped,monthRange,rowDate} from './creator-sampling-core.js';
import type {ReadTable} from './feishu.js';
const range={from:'2026-09-01',to:'2026-12-01'};
function primary(rows:unknown[][]):ReadTable{return {name:'寄样统计表（天）',columns:['日期','达人名称','是否邮寄','寄样产品名称','寄样产品数量','品类','达人等级'],rows,complete:true}}
function secondary(rows:unknown[][],documentName='10月达人跟进表'):ReadTable{return {name:'sheet1',documentName,columns:['日期','Buyer Username','备注'],rows,complete:true}}
describe('creator dashboard calendar dates',()=>{
 it('uses three complete natural months including the current China month',()=>{
  expect(calendarRange(new Date('2026-11-06T10:00:00Z'))).toEqual(range);
  expect(calendarRange(new Date('2026-12-31T16:00:00Z'))).toEqual({from:'2026-11-01',to:'2027-02-01'});
 });
 it('takes the real document title, resolves month-only years across New Year, and never guesses an unrelated month',()=>{
  expect(filenameMonth('10月达人跟进表',range)).toEqual({year:2026,month:10});
  expect(filenameMonth('2026年10月达人跟进表',range)).toEqual({year:2026,month:10});
  expect(filenameMonth('12月达人跟进表',{from:'2026-11-01',to:'2027-02-01'})).toEqual({year:2026,month:12});
  expect(filenameMonth('sheet1',range)).toBeNull();expect(filenameMonth('6月达人跟进表',range)).toBeNull();
 });
 it('prefers complete row dates, validates real calendar days and handles timestamps and spreadsheet serials',()=>{
  expect(rowDate('2026年11月2日','10月达人跟进表',range)).toBe('2026-11-02');
  expect(rowDate(6,'10月达人跟进表',range)).toBe('2026-10-06');
  expect(rowDate('2026-10-05T16:00:00Z','',range)).toBe('2026-10-06');
  expect(rowDate(46301,'',range)).toBe('2026-10-06');
  expect(rowDate('2026-02-31','',range)).toBeNull();expect(rowDate(31,'11月达人跟进表',range)).toBeNull();
  expect(rowDate(6,'sheet1',range)).toBeNull();
 });
});
describe('creator fulfillment matching',()=>{
 it('ignores empty and date-only placeholders without warning and keeps partial business records',()=>{
  const main=primary([
   [null,null,null,null,null,null,null],
   ['2026-10-21','  ',[],null,null,'',null],
   ['invalid-date',null,null,null,null,null,null],
   ['2026-10-21',null,null,null,1,null,null],
   ['2026-10-26',null,null,null,0,null,null],
   ['2026-10-07',null,'是',null,null,null,null],
   ['2026-10-21','alice','是','商品',1,'盲盒','L2']
  ]);
  main.recordIds=['empty','date-only','invalid-date-only','quantity-only','zero-quantity','status-only','complete'];
  const data=buildSamplingData(main,[],range);
  expect(data.quality).toEqual([]);
  expect(data.records.map(record=>record.id)).toEqual(['quantity-only','zero-quantity','status-only','complete']);
  expect(data.records.map(record=>record.quantity)).toEqual([1,0,null,1]);
  expect(buildSamplingData(primary([['invalid-date','alice',null,null,null,null,null]]),[],range).quality).toEqual(['一类表 1 行日期无效，未纳入统计']);
 });
 it('requires same date and account, deduplicates products and sheets, and handles merged dates',()=>{
  const main=primary([
   ['2026-10-06','@Alice',['是'],'商品甲',2,['盲盒'],'L2'],
   ['2026-10-06','alice',['是'],'商品乙',1,['盲盒'],'L2'],
   ['2026-10-07','alice',['是'],'商品甲',1,['常规'],'L3'],
   ['2026-10-06','bob',['是'],'商品甲',1,['常规'],'L1'],
   ['2026-10-06','carol',['否'],'商品甲',1,['毛绒'],'L4'],
   ['2026-08-31','outside',['是'],'商品甲',1,['毛绒'],'L4'],
   ['2026-12-01','outside',['是'],'商品甲',1,['毛绒'],'L4']
  ]);
  const follow=secondary([[6,'https://www.tiktok.com/@ALICE','视频履约'],[null,'bob','直播'],[6,'carol','直播'],[7,'bob','视频履约']]);
  const result=buildSamplingData(main,[follow,follow],range);
  expect(result.records).toHaveLength(5);expect(result.records.map(r=>r.fulfilled)).toEqual([true,true,false,true,false]);
  const due=new Set(result.records.filter(r=>r.shipped).map(r=>r.date+'|'+r.creator));
  const done=new Set(result.records.filter(r=>r.fulfilled).map(r=>r.date+'|'+r.creator));
  expect(due.size).toBe(3);expect(done.size).toBe(2);
 });
 it('does not treat a negative status as shipped or fulfilled',()=>{
  expect(isShipped(['是'])).toBe(true);for(const value of ['否','未邮寄',null,'待寄样'])expect(isShipped(value)).toBe(false);
  for(const value of ['未直播','待视频履约','尚未直播','没有视频履约','取消直播','不履约'])expect(isFulfilled(value)).toBe(false);
  expect(isFulfilled('已直播；视频履约')).toBe(true);
  expect(accountKey(' @Ａlice ')).toBe('alice');
 });
 it('does not infer a date from the worksheet name and reports unusable dates',()=>{
  const follow=secondary([[6,'alice','直播']],'');follow.name='2026年10月';
  const data=buildSamplingData(primary([['2026-10-06','alice','是','商品',1,'盲盒','L2']]),[follow],range);
  expect(data.records[0].fulfilled).toBe(false);expect(data.quality.join()).toContain('无法识别完整日期');
 });
 it('retains main metrics without a selected secondary table and rejects partial or structurally invalid sources',()=>{
  const main=primary([['2026-09-01','alice','是','商品',1,'常规','L2']]);
  expect(buildSamplingData(main,[],range)).toMatchObject({fulfillmentAvailable:false,records:[{date:'2026-09-01'}]});
  expect(()=>buildSamplingData({...main,complete:false},[],range)).toThrow('未完整读取');
  expect(()=>buildSamplingData(main,[{...secondary([]),columns:['名字']}],range)).toThrow('缺少字段');
 });
 it('does not carry an invalid explicit date into following merged rows',()=>{
  const data=buildSamplingData(primary([['2026-10-06','bob','是','商品',1,'常规','']]),[secondary([[6,'alice','直播'],[99,'bad','直播'],[null,'bob','直播']])],range);
  expect(data.records[0].fulfilled).toBe(false);expect(data.quality.join()).toContain('2 行');
 });
});

describe('automatic secondary months',()=>{
 const now=new Date('2026-11-06T08:00:00Z');
 it('does not count blank placeholders as invalid dates or available months, but preserves date anchors',()=>{
  const follow=secondary([
   [null,'  ',null],['invalid-date',null,null],['2026-11-01',null,null],
   ['2026-10-06',null,null],[null,'alice','直播']
  ],'');
  const data=automaticSecondaryData([follow],now);
  expect(data.months).toEqual(['2026-10']);
  expect(data.quality).toEqual([]);
  expect(data.tables[0].rows).toEqual([['2026-10-06','alice','直播']]);
  const main=primary([['2026-10-06','alice','是','商品',1,'常规','L2']]);
  expect(buildSamplingData(main,[follow],range).records[0].fulfilled).toBe(true);
  const invalid=automaticSecondaryData([secondary([['invalid-date',null,null],[null,'alice','直播']],'')],now);
  expect(invalid.quality.join()).toContain('1 行');
 });
 it('keeps only the latest three existing months and includes every sheet in those months',()=>{
  const data=automaticSecondaryData([
   secondary([[1,'a','直播']],'7月达人跟进表'),secondary([[1,'b','直播']],'8月达人跟进表'),
   secondary([[1,'c','直播']],'9月达人跟进表'),secondary([[1,'d','直播']],'10月达人跟进表'),
   secondary([[2,'e','直播']],'10月达人跟进表（补充）')
  ],now);
  expect(data.months).toEqual(['2026-08','2026-09','2026-10']);
  expect(data.tables).toHaveLength(4);
  expect(data.tables.flatMap(t=>t.rows.map(r=>r[0]))).toEqual(['2026-08-01','2026-09-01','2026-10-01','2026-10-02']);
 });
 it('uses actual available months across gaps and calendar years',()=>{
  const data=automaticSecondaryData([secondary([[6,'a','直播']],'12月达人跟进表'),secondary([[6,'b','直播']],'2月达人跟进表'),secondary([[6,'c','直播']],'10月达人跟进表')],now);
  expect(data.months).toEqual(['2025-12','2026-02','2026-10']);
  expect(monthRange('2025-12')).toEqual({from:'2025-12-01',to:'2026-01-01'});
 });
 it('prefers full row dates to filenames and rejects future months',()=>{
  const data=automaticSecondaryData([secondary([['2026-09-01','a','直播'],['2026-11-01','b','直播'],['2026-12-01','c','直播']],'8月达人跟进表')],now);
  expect(data.months).toEqual(['2026-09','2026-11']);expect(data.tables[0].rows).toHaveLength(2);
 });
 it('normalizes merged dates before removing old months and resets invalid explicit dates',()=>{
  const data=automaticSecondaryData([secondary([[6,'a','直播'],[null,'b','直播'],[99,'bad','直播'],[null,'c','直播']])],now);
  expect(data.tables[0].rows.map(r=>r[0])).toEqual(['2026-10-06','2026-10-06']);expect(data.quality.join()).toContain('2 行');
 });
 it('handles empty, undated and incomplete sources without guessing from a worksheet title',()=>{
  expect(automaticSecondaryData([],now).months).toEqual([]);
  const unknown=secondary([[6,'a','直播']],'');unknown.name='10月达人跟进表';
  expect(automaticSecondaryData([unknown],now)).toMatchObject({months:[],tables:[]});
  expect(automaticSecondaryData([secondary([])],now).months).toEqual(['2026-10']);
  expect(()=>automaticSecondaryData([{...secondary([]),complete:false}],now)).toThrow('未完整读取');
 });
 it('excludes intervening primary months even within the combined date range',()=>{
  const main=primary([['2026-07-06','a','是','商品',1,'盲盒',''],['2026-08-06','b','是','商品',1,'盲盒',''],['2026-10-06','c','是','商品',1,'盲盒','']]);
  const data=buildSamplingData(main,[],{from:'2026-07-01',to:'2026-11-01'},now,['2026-07','2026-10']);
  expect(data.records.map(r=>r.date)).toEqual(['2026-07-06','2026-10-06']);
 });
});
