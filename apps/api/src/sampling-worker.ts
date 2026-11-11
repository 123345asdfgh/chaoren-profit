import type {CreatorSampling} from './creator-sampling.js';
import {SamplingCache,collectSource,SAMPLING_REFRESH_MS,type Sources} from './sampling-cache.js';

type Logger={info:(data:unknown,message?:string)=>void;error:(data:unknown,message?:string)=>void};
export class SamplingWorker{
 private jobs=new Map<string,Promise<void>>();
 private timer:ReturnType<typeof setInterval>|undefined;
 private stopped=false;
 constructor(private cache:SamplingCache,private scanner:Pick<CreatorSampling,'read'>,private owners:()=>Promise<string[]>,private logger:Logger){}
 async enable(owner:string,refresh=false){if(await this.cache.activate(owner)||refresh)this.request(owner)}
 request(owner:string){
  if(this.stopped||this.jobs.has(owner))return;
  // Remote reads start on a later turn of the event loop, never on the dashboard read path.
  const job=new Promise<void>(resolve=>setImmediate(resolve)).then(()=>this.refresh(owner)).catch(error=>this.logger.error({error:error instanceof Error?error.message:'后台同步失败'},'达人缓存同步失败')).finally(()=>this.jobs.delete(owner));
  this.jobs.set(owner,job);
 }
 async refresh(owner:string){
  if(this.stopped)return;
  const token=await this.cache.acquire(owner);if(!token)return;
  const heartbeat=setInterval(()=>{void this.cache.renew(owner,token).catch(error=>this.logger.error({error:error.message},'缓存同步续锁失败'))},30_000);heartbeat.unref();
  try{
   const sources:Sources={rows:{},tables:{}};
   const data=await this.scanner.read(owner,{},(key,table)=>collectSource(sources,key,table));
   if(this.stopped)return;
   const delta=await this.cache.publish(owner,token,data,sources);
   this.logger.info({delta,records:data.records.length},'达人看板缓存差异核对完成');
  }catch(error){await this.cache.fail(owner,token,error);throw error}
  finally{clearInterval(heartbeat);await this.cache.release(owner,token)}
 }
 async read(owner:string,input:unknown={}){
  // Keep the same strict request contract as the old read endpoint.
  if(input===null||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw Object.assign(Error('看板读取参数无效。'),{statusCode:400});
  const result=await this.cache.read(owner);
  if(!result.cache.ready&&!result.cache.error)this.request(owner);
  return result;
 }
 async tick(){for(const owner of await this.owners())this.request(owner)}
 start(){
  this.stopped=false;
  const tick=()=>{void this.tick().catch(error=>this.logger.error({error:error.message},'无法获取缓存同步用户列表'))};
  this.timer=setInterval(tick,SAMPLING_REFRESH_MS);this.timer.unref();tick();
 }
 async stop(){this.stopped=true;if(this.timer)clearInterval(this.timer);await Promise.allSettled([...this.jobs.values()])}
}
