type CalendarDate={year:number;month:number;day:number;key:string};
type DateCell={text:string;rowSpan:number};
const scalar=(value:unknown):string=>{
 if(value==null)return '';
 if(Array.isArray(value))return value.map(scalar).filter(Boolean).join('、');
 if(typeof value==='object'){const record=value as Record<string,unknown>;return scalar(record.text??record.name??record.value)}
 return String(value).trim();
};
function checked(year:number,month:number,day:number):CalendarDate|null{
 const stamp=new Date(Date.UTC(year,month-1,day));
 return stamp.getUTCFullYear()===year&&stamp.getUTCMonth()===month-1&&stamp.getUTCDate()===day?
 {year,month,day,key:`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`}:null;
}
function chinaDate(value:Date):CalendarDate|null{
 if(!Number.isFinite(value.getTime()))return null;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);
 return checked(Number(parts.find(p=>p.type==='year')!.value),Number(parts.find(p=>p.type==='month')!.value),Number(parts.find(p=>p.type==='day')!.value));
}
function namedMonth(documentName:string,now:Date){
 const full=documentName.match(/((?:19|20)\d{2})\s*(?:年|[-_.\/])\s*(1[0-2]|0?[1-9])(?:月|[-_.\/]|\D|$)/u);
 if(full)return {year:Number(full[1]),month:Number(full[2])};
 const months=[...documentName.matchAll(/(?<!\d)(1[0-2]|0?[1-9])\s*月/gu)],today=chinaDate(now)!;
 if(months.length!==1)return null;
 const month=Number(months[0][1]);return {year:today.year-(month>today.month?1:0),month};
}
export function parseTableDate(value:unknown,documentName:string,now=new Date()):CalendarDate|null{
 const text=scalar(value).normalize('NFKC');if(!text)return null;
 const full=text.match(/^(\d{4})\s*[-\/.年]\s*(\d{1,2})\s*[-\/.月]\s*(\d{1,2})(?:日|\b|T)/u);
 if(full){
  const date=checked(Number(full[1]),Number(full[2]),Number(full[3]));
  if(!date)return null;
  return /T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)?chinaDate(new Date(text)):date;
 }
 const numeric=Number(text);
 if(/^\d+(?:\.\d+)?$/.test(text)){
  if(numeric>1e9)return chinaDate(new Date(numeric<1e11?numeric*1000:numeric));
  if(numeric>=30000&&numeric<=80000){const date=new Date(Date.UTC(1899,11,30)+Math.floor(numeric)*86400000);return checked(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate())}
 }
 const named=namedMonth(documentName,now);
 const partial=text.match(/^(\d{1,2})\s*(?:月|[-\/\.])\s*(\d{1,2})日?$/u);
 if(partial&&named)return checked(named.year,Number(partial[1]),Number(partial[2]));
 if(/^\d{1,2}日?$/.test(text)&&named)return checked(named.year,named.month,parseInt(text,10));
 return null;
}
/** Resolve merged source dates before pagination; merge only adjacent dates on the current page. */
export function tableDisplayRows(columns:string[],rows:unknown[][],documentName:string,page:number,pageSize:number,now=new Date()){
 const dateColumns=columns.flatMap((column,index)=>/^(?:日期|寄样日期|年月日|时间|date)$|日期$/i.test(column.replace(/\s+/g,''))?[index]:[]);
 const inherited=new Map<number,CalendarDate|null>(),parsedDates=new Map<string,CalendarDate|null>();
 const resolved=rows.map((row,index)=>{
  const dates=new Map<number,{date:CalendarDate|null;text:string}>();
  for(const column of dateColumns){
   const raw=scalar(row[column]);
   if(raw){
    if(!parsedDates.has(raw))parsedDates.set(raw,parseTableDate(row[column],documentName,now));
    inherited.set(column,parsedDates.get(raw)!);
   }
   const date=inherited.get(column)??null;
   dates.set(column,{date,text:date?`${date.year}年${date.month}月${date.day}日`:raw||'—'});
  }
  return {row,index,dates};
 });
 const visible=resolved.slice((page-1)*pageSize,page*pageSize);
 const result=visible.map(item=>({...item,dateCells:new Map<number,DateCell>()}));
 for(const column of dateColumns){
  for(let index=0;index<visible.length;){
   const current=visible[index].dates.get(column)!;let end=index+1;
   if(current.date)while(end<visible.length&&visible[end].dates.get(column)?.date?.key===current.date.key)end++;
   result[index].dateCells.set(column,{text:current.text,rowSpan:end-index});
   for(let hidden=index+1;hidden<end;hidden++)result[hidden].dateCells.set(column,{text:'',rowSpan:0});
   index=end;
  }
 }
 return result;
}
