import type {FastifyInstance,FastifyReply,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {ReadTable} from './feishu.js';
import {SavedFeishuTables} from './feishu-saved-tables.js';
import {validateSamplingRecord} from './sampling-validity.js';
import {automaticSecondaryData,buildSamplingData,calendarRange,monthRange,type SamplingTable} from './creator-sampling-core.js';
import {attachSamplingCosts,SAMPLING_COST_RATE,type CostLoader} from './creator-sampling-costs.js';
const readSchema=z.strictObject({}).default({});
type Owner=(request:FastifyRequest,reply:FastifyReply)=>Promise<string>;
const primaryColumns=['日期','达人名称','是否邮寄','寄样产品名称','寄样产品数量','品类','达人等级'];
export type SamplingSource=(key:string,table:ReadTable)=>void;
export class CreatorSampling{
 private busy=new Set<string>();
 constructor(private tables:Pick<SavedFeishuTables,'list'|'read'>,private now=()=>new Date(),private costs:CostLoader=async()=>[]){}
 async sources(owner:string){return {...await this.tables.list(owner),mode:'automatic' as const}}
 async read(owner:string,input:unknown={},onSource?:SamplingSource){
  readSchema.parse(input);
  if(this.busy.has(owner))throw Object.assign(Error('看板正在读取中，请稍候。'),{statusCode:409});
  this.busy.add(owner);
  try{
   const now=this.now(),available=await this.tables.list(owner),secondary:SamplingTable[]=[];
   // Sheets must be inspected to resolve row dates and merged date cells. Only
   // the latest three available months are retained for any dashboard metric.
   // The official CLI shares one profile lock: read each source sequentially.
   for(const table of available.tables.filter(t=>t.sourceType==='secondary')){
    const page=await this.tables.read(owner,table.id);secondary.push({...page,sourceKey:'secondary:'+table.id});onSource?.('secondary:'+table.id,page);
   }
   const prepared=automaticSecondaryData(secondary,now),months=prepared.months;
   const range=months.length?{from:monthRange(months[0]).from,to:monthRange(months.at(-1)!).to}:calendarRange(now);
   const primary:ReadTable={name:'寄样统计表（天）',columns:primaryColumns,rows:[],recordIds:[],complete:true};
   if(months.length){
    const fixed=available.tables.find(t=>t.sourceType==='primary')!;
    for(const month of months){
     // Query each actual month separately so gaps do not fetch unrelated months.
     const page=await this.tables.read(owner,fixed.id,{dateRange:{field:'日期',...monthRange(month)}});
     onSource?.('primary:'+fixed.id+':'+month,page);
     if(!page.complete)throw Object.assign(Error('一类表未完整读取，已保留上次数据，请稍后重试。'),{statusCode:422});
     if(primary.rows.length&&JSON.stringify(primary.columns)!==JSON.stringify(page.columns))throw Object.assign(Error('读取期间一类表字段发生变化，请重新读取。'),{statusCode:409});
     primary.columns=page.columns;primary.rows.push(...page.rows);primary.recordIds!.push(...page.rows.map((_,i)=>page.recordIds?.[i]||month+'-'+i));
    }
   }
   const result=buildSamplingData(primary,prepared.tables,range,now,months);
   const records=attachSamplingCosts([...result.records,...prepared.invalidRecords],await this.costs([...new Set(result.records.map(record=>record.product).filter(Boolean))])).map(validateSamplingRecord);
   return {...result,records,quality:[],source:{...result.source,mode:'automatic',months,range:months.length?range:null,secondaryCount:prepared.tables.length,costRate:SAMPLING_COST_RATE,costCurrency:'RMB'}};
  }finally{this.busy.delete(owner)}
 }
}
export function registerCreatorSamplingRoutes(app:FastifyInstance,prefix:string,owner:Owner,dashboard:{sources(owner:string):Promise<unknown>;read(owner:string,input?:unknown):Promise<unknown>},refresh?:(owner:string)=>void){
 const route=prefix+'/creator-sampling';
 app.addHook('onSend',async(request,reply,payload)=>{if(request.url.startsWith(route))reply.header('cache-control','no-store');return payload});
 app.get(route+'/sources',async(request,reply)=>dashboard.sources(await owner(request,reply)));
 app.get(route+'/data',async(request,reply)=>dashboard.read(await owner(request,reply)));
 app.post(route+'/read',async(request,reply)=>dashboard.read(await owner(request,reply),request.body));
 if(refresh)app.post(route+'/refresh',async(request,reply)=>{readSchema.parse(request.body);refresh(await owner(request,reply));return reply.code(202).send({queued:true})});
}
export type SamplingData=Awaited<ReturnType<CreatorSampling['read']>>;
