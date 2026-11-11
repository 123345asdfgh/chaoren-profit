import type {FastifyInstance,FastifyReply,FastifyRequest} from 'fastify';
import {z} from 'zod';
import {SavedFeishuTables} from './feishu-saved-tables.js';
import {buildSamplingData,calendarRange} from './creator-sampling-core.js';
const selectionSchema=z.strictObject({tableIds:z.array(z.uuid()).max(3)});
type Owner=(request:FastifyRequest,reply:FastifyReply)=>Promise<string>;
export class CreatorSampling{
 private busy=new Set<string>();
 constructor(private tables:SavedFeishuTables,private now=()=>new Date()){}
 async sources(owner:string){
  const available=await this.tables.list(owner),selectedIds=await this.tables.selection(owner);
  return {...available,selectedIds:selectedIds.filter(id=>available.tables.some(t=>t.id===id&&t.sourceType==='secondary')),range:calendarRange(this.now())};
 }
 async read(owner:string,input:unknown){
  const {tableIds}=selectionSchema.parse(input);
  if(this.busy.has(owner))throw Object.assign(Error('看板正在读取中，请稍候。'),{statusCode:409});
  this.busy.add(owner);
  try{
   const selected=await this.tables.selectedSources(owner,tableIds),primary=await this.tables.ensurePrimary(owner),now=this.now(),range=calendarRange(now);
   const first=await this.tables.read(owner,primary.id,{dateRange:{field:'日期',...range}}),secondary=[];
   // The official CLI uses one profile lock per user; do not read that profile concurrently.
   for(const table of selected)secondary.push(await this.tables.read(owner,table.id));
   const result=buildSamplingData(first,secondary,range,now);
   await this.tables.remember(owner,tableIds);
   return {...result,selectedIds:tableIds};
  }finally{this.busy.delete(owner)}
 }
}
export function registerCreatorSamplingRoutes(app:FastifyInstance,prefix:string,owner:Owner,dashboard:CreatorSampling){
 const route=prefix+'/creator-sampling';
 app.addHook('onSend',async(request,reply,payload)=>{if(request.url.startsWith(route))reply.header('cache-control','no-store');return payload});
 app.get(route+'/sources',async(request,reply)=>dashboard.sources(await owner(request,reply)));
 app.post(route+'/read',async(request,reply)=>dashboard.read(await owner(request,reply),request.body));
}
