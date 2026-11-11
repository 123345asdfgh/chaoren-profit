import {createClient} from 'redis';

export function samplingRedis(){
 const client=createClient({url:process.env.REDIS_URL||'redis://127.0.0.1:6381',disableOfflineQueue:true,socket:{connectTimeout:1500,reconnectStrategy:()=>false}});
 client.on('error',()=>{});
 let connecting:Promise<unknown>|undefined;
 return {
  async sendCommand(args:string[]){
   if(!client.isReady){connecting??=client.connect().finally(()=>{connecting=undefined});await connecting}
   return client.sendCommand(args);
  },
  async close(){if(client.isOpen)await client.close()}
 };
}
