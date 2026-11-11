import type {ReadTable} from './feishu.js';
export type DateRange={from:string;to:string};
export type SamplingRecord={id:string;date:string;creator:string;level:string;product:string;category:string;quantity:number|null;shipped:boolean;fulfilled:boolean;
 invalidReasons?:string[];sourceType?:'primary'|'secondary';sourceName?:string;sourceRecordId?:string;sourceRow?:number;
 raw?:{date:string;level?:string;quantity?:string;shipped?:string;remark?:string}};
export type SamplingTable=ReadTable&{sourceKey?:string;rowNumbers?:number[]};
function secondaryInvalid(table:SamplingTable,index:number,date:string|null,creator:string,reasons:string[]):SamplingRecord{
 const row=table.rows[index],dateIndex=columns(table,['日期','寄样日期','年月日','时间','Date']);
 const remarkIndex=columns(table,['备注','履约备注']);
 return {id:'invalid-secondary:'+ (table.sourceKey||table.documentName||table.name)+':'+(table.recordIds?.[index]||index),date:date||'',creator,level:'',product:'',category:'',quantity:null,shipped:false,fulfilled:false,
 sourceType:'secondary',sourceName:table.documentName||table.name,sourceRecordId:table.recordIds?.[index],sourceRow:table.rowNumbers?.[index]??index+1,invalidReasons:reasons,raw:{date:scalar(row[dateIndex]),remark:scalar(row[remarkIndex])}};
}
const pad=(v:number)=>String(v).padStart(2,'0');
export function calendarRange(now=new Date()):DateRange{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).formatToParts(now);
 const y=Number(parts.find(p=>p.type==='year')!.value),m=Number(parts.find(p=>p.type==='month')!.value);
 return {from:new Date(Date.UTC(y,m-3,1)).toISOString().slice(0,10),to:new Date(Date.UTC(y,m,1)).toISOString().slice(0,10)};
}
export function scalar(value:unknown):string{
 if(value==null)return '';
 if(Array.isArray(value))return value.map(scalar).filter(Boolean).join('、');
 if(typeof value==='object'){const v=value as Record<string,unknown>;return scalar(v.text??v.name??v.value??'')}
 return String(value).trim();
}
function validDate(y:number,m:number,d:number){
 const v=new Date(Date.UTC(y,m-1,d));
 return v.getUTCFullYear()===y&&v.getUTCMonth()===m-1&&v.getUTCDate()===d?`${y}-${pad(m)}-${pad(d)}`:null;
}
function inRange(date:string,range:DateRange){return date>=range.from&&date<range.to}
function yearForMonth(month:number,range:DateRange){
 let date=new Date(range.from+'T00:00:00Z');const years=new Set<number>();
 while(date.toISOString().slice(0,10)<range.to){if(date.getUTCMonth()+1===month)years.add(date.getUTCFullYear());date.setUTCMonth(date.getUTCMonth()+1)}
 return years.size===1?[...years][0]:null;
}
export function filenameMonth(name:string,range:DateRange):{year:number;month:number}|null{
 const full=name.match(/((?:19|20)\d{2})\s*(?:年|[-_.\/])\s*(1[0-2]|0?[1-9])(?:月|[-_.\/]|\D|$)/u);
 if(full)return {year:Number(full[1]),month:Number(full[2])};
 const matches=[...name.matchAll(/(?<!\d)(1[0-2]|0?[1-9])\s*月/gu)];
 if(matches.length!==1)return null;
 const month=Number(matches[0][1]),year=yearForMonth(month,range);
 return year?{year,month}:null;
}
export function rowDate(value:unknown,documentName:string,range:DateRange):string|null{
 const text=scalar(value);if(!text)return null;
 const iso=text.match(/^(\d{4})[-\/.年](\d{1,2})[-\/.月](\d{1,2})(?:日|\b|T)/u);
 if(iso){
  const checked=validDate(Number(iso[1]),Number(iso[2]),Number(iso[3]));if(!checked)return null;
  if(/T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)){
   const stamp=new Date(text);if(!Number.isFinite(stamp.getTime()))return null;
   return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(stamp);
  }
  return checked;
 }
 const numeric=Number(text);
 if(/^\d+(?:\.\d+)?$/.test(text)&&numeric>1e9){
  const d=new Date(numeric<1e11?numeric*1000:numeric);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):null;
 }
 if(/^\d+(?:\.\d+)?$/.test(text)&&numeric>=30000&&numeric<=80000)return new Date(Date.UTC(1899,11,30)+Math.floor(numeric)*86400000).toISOString().slice(0,10);
 const named=filenameMonth(documentName,range);
 const monthDay=text.match(/^(\d{1,2})\s*(?:月|[-\/\.])\s*(\d{1,2})日?$/u);
 if(monthDay){const m=Number(monthDay[1]),year=named?.year??yearForMonth(m,range);return year?validDate(year,m,Number(monthDay[2])):null}
 if(/^\d{1,2}日?$/.test(text)&&named)return validDate(named.year,named.month,parseInt(text,10));
 return null;
}
export function accountKey(value:string){
 let account=value.normalize('NFKC').trim();
 const url=account.match(/^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([^/?#]+)/i);if(url)account=url[1];
 return account.replace(/^@/,'').trim().toLowerCase();
}
export function isShipped(value:unknown){return /^(是|已邮寄|已寄样|已寄出|已发货|已寄|已邮寄样品|yes|true|1)$/i.test(scalar(value))}
export function isFulfilled(value:unknown){
 // A negative status must not become a positive match merely because it contains the keyword.
 return scalar(value).split(/[、，,；;\n]/u).some(part=>!/未|待|没有|尚未|取消|不履约|无需/u.test(part)&&/直播|视频履约/u.test(part));
}
const columnKey=(value:string)=>value.replace(/\s+/g,'').toLowerCase();
function columns(table:ReadTable,aliases:string[],required=true){
 const index=table.columns.findIndex(c=>aliases.some(a=>columnKey(a)===columnKey(c)));
 if(index<0&&required)throw Object.assign(Error(`「${table.documentName||table.name}」缺少字段：${aliases[0]}。`),{statusCode:422});
 return index;
}
// A default date alone does not make a sampling record. Keep partial business
// rows (including zero quantities) so their missing fields are still checked.
function hasBusinessContent(row:unknown[],dateIndex:number){
 return row.some((cell,index)=>index!==dateIndex&&scalar(cell)!=='');
}
export function monthRange(month:string):DateRange{
 const [year,value]=month.split('-').map(Number);
 return {from:month+'-01',to:new Date(Date.UTC(year,value,1)).toISOString().slice(0,10)};
}
export function automaticSecondaryData(tables:SamplingTable[],now=new Date()){
 const current=calendarRange(now),end=new Date(current.to+'T00:00:00Z');
 const currentMonth=new Date(end.getTime()-86400000).toISOString().slice(0,7);
 // A month-only Chinese filename means its most recent occurrence. Complete
 // dates in rows always take precedence, including across calendar years.
 const context={from:new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-12,1)).toISOString().slice(0,10),to:current.to};
 const found=new Set<string>(),quality:string[]=[];
 const dated=tables.map(table=>{
  if(!table.complete)throw Object.assign(Error('本次表格未完整读取，已保留上次数据，请缩小表格范围后重试。'),{statusCode:422});
  const index=columns(table,['日期','寄样日期','年月日','时间','Date']);
  const invalidRecords:SamplingRecord[]=[];
  const rows:{row:unknown[];date:string;index:number}[]=[];
  let previousDate:string|null=null,invalid=0,hasDate=false;
  for(const [rowIndex,row] of table.rows.entries()){
   if(scalar(row[index]))previousDate=rowDate(row[index],table.documentName||'',context);
   // Date-only rows can be merged-date anchors for the following business row.
   if(!hasBusinessContent(row,index))continue;
   if(!previousDate){invalid++;const creatorIndex=columns(table,['Buyer Username','达人名称','达人账号','TikTok账号','达人','账号']);const creator=accountKey(scalar(row[creatorIndex]));invalidRecords.push(secondaryInvalid(table,rowIndex,null,creator,['日期缺失或无效',...(!creator?['缺少达人账号']:[])]));continue}
   hasDate=true;
   if(previousDate.slice(0,7)>currentMonth)continue;
   found.add(previousDate.slice(0,7));rows.push({row,date:previousDate,index:rowIndex});
  }
  const named=filenameMonth(table.documentName||'',context);
  const emptyMonth=!hasDate&&named?`${named.year}-${pad(named.month)}`:null;
  if(emptyMonth&&emptyMonth<=currentMonth)found.add(emptyMonth);
  if(invalid)quality.push(`「${table.documentName||table.name}」${invalid} 行无法识别完整日期，未纳入统计；请补全表内日期或文件中文名称中的年月`);
  return {table,index,rows,emptyMonth,invalidRecords,namedMonth:named?`${named.year}-${pad(named.month)}`:null};
 });
 const months=[...found].sort().slice(-3);
 const active=dated.filter(item=>item.rows.some(row=>months.includes(row.date.slice(0,7)))||!!item.emptyMonth&&months.includes(item.emptyMonth));
 const invalidRecords=dated.filter(item=>active.includes(item)||!item.rows.length&&!item.namedMonth).flatMap(item=>item.invalidRecords);
 return {months,quality,invalidRecords,tables:active.map(({table,index,rows})=>{
  const selected=rows.filter(item=>months.includes(item.date.slice(0,7)));
  return {...table,rows:selected.map(({row,date})=>row.map((cell,column)=>column===index?date:cell)),recordIds:selected.map(item=>table.recordIds?.[item.index]||String(item.index)),rowNumbers:selected.map(item=>table.rowNumbers?.[item.index]??item.index+1)};
 })};
}
export function buildSamplingData(primary:ReadTable,secondary:SamplingTable[],range:DateRange,now=new Date(),months?:readonly string[]){
 if([primary,...secondary].some(table=>!table.complete))throw Object.assign(Error('本次表格未完整读取，已保留上次数据，请缩小表格范围后重试。'),{statusCode:422});
 const invalidRecords:SamplingRecord[]=[];const fulfilled=new Set<string>();let invalidSecondaryDates=0,invalidPrimaryDates=0,secondaryRows=0,filenameRows=0;
 for(const table of secondary){
  const dateIndex=columns(table,['日期','寄样日期','年月日','时间','Date']),creatorIndex=columns(table,['Buyer Username','达人名称','达人账号','TikTok账号','达人','账号']),remarkIndex=columns(table,['备注','履约备注']);
  let previousDate:string|null=null;
  for(const [rowIndex,row] of table.rows.entries()){
   const rawDate=scalar(row[dateIndex]);
   if(rawDate)previousDate=rowDate(row[dateIndex],table.documentName||'',range);
   if(!hasBusinessContent(row,dateIndex))continue;
   const creator=accountKey(scalar(row[creatorIndex]));
   secondaryRows++;
   if(!previousDate){invalidSecondaryDates++;invalidRecords.push(secondaryInvalid(table,rowIndex,null,creator,['日期缺失或无效',...(!creator?['缺少达人账号']:[])]));continue}
   if(!inRange(previousDate,range)||months&&!months.includes(previousDate.slice(0,7)))continue;
   if(!creator){invalidRecords.push(secondaryInvalid(table,rowIndex,previousDate,'',['缺少达人账号']));continue}
   if(rawDate&&/^\d{1,2}日?$/.test(rawDate))filenameRows++;
   if(isFulfilled(row[remarkIndex]))fulfilled.add(previousDate+'|'+creator);
  }
 }
 const dateIndex=columns(primary,['日期','寄样日期']),creatorIndex=columns(primary,['达人名称','达人账号']),shippedIndex=columns(primary,['是否邮寄','是否寄样']);
 const productIndex=columns(primary,['寄样产品名称','寄样产品']),quantityIndex=columns(primary,['寄样产品数量','寄样数量']),categoryIndex=columns(primary,['品类','商品属性']),levelIndex=columns(primary,['达人等级','等级'],false);
 const records:SamplingRecord[]=[];
 for(const [index,row] of primary.rows.entries()){
  if(!hasBusinessContent(row,dateIndex))continue;
  const date=rowDate(row[dateIndex],primary.documentName||'',range);
  if(!date)invalidPrimaryDates++;
  if(date&&(!inRange(date,range)||months&&!months.includes(date.slice(0,7))))continue;
  const creator=scalar(row[creatorIndex]),key=accountKey(creator),rawQuantity=scalar(row[quantityIndex]),quantity=Number(rawQuantity.replace(/,/g,'')),shipped=isShipped(row[shippedIndex]);
  const level=scalar(row[levelIndex]).toUpperCase().match(/^L?([1-7])$/)?.[1];
  records.push({id:primary.recordIds?.[index]||String(index),date:date||'',sourceType:'primary',sourceName:primary.documentName||primary.name,sourceRecordId:primary.recordIds?.[index],sourceRow:index+1,raw:{date:scalar(row[dateIndex]),level:scalar(row[levelIndex]),quantity:rawQuantity,shipped:scalar(row[shippedIndex])},creator:key||creator,level:level?'L'+level:'',product:scalar(row[productIndex]),category:scalar(row[categoryIndex]),quantity:rawQuantity!==''&&Number.isFinite(quantity)&&quantity>=0?quantity:null,shipped,fulfilled:shipped&&!!key&&fulfilled.has(date+'|'+key)});
 }
 const quality:string[]=[];
 if(invalidPrimaryDates)quality.push(`一类表 ${invalidPrimaryDates} 行日期无效，未纳入统计`);
 if(invalidSecondaryDates)quality.push(`二类表 ${invalidSecondaryDates} 行无法识别完整日期，未用于履约匹配；请在表内补全年月日，或在文件中文名称中注明年月`);
 return {records:[...records,...invalidRecords],quality,fulfillmentAvailable:secondary.length>0,source:{fetchedAt:now.toISOString(),range,hasMore:false,categoryOptions:[...new Set(records.map(r=>r.category).filter(Boolean))],secondaryRows,filenameRows,secondaryNames:secondary.map(t=>t.documentName||t.name)}};
}
