import {createConnection} from 'node:net';
import {mkdir,access,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

// A remote Redis is managed by deployment. Only start this project's private local instance.
const target=new URL(process.env.REDIS_URL||'redis://127.0.0.1:6381');
if(target.protocol!=='redis:'||!['127.0.0.1','localhost'].includes(target.hostname)||target.port!=='6381'||target.username||target.password){console.log('使用配置的 Redis 服务。');process.exit(0)}
const root=fileURLToPath(new URL('../',import.meta.url)),directory=path.join(root,'.local/redis');
function ping(){return new Promise(resolve=>{
 const socket=createConnection({host:'127.0.0.1',port:6381}),finish=value=>{socket.destroy();resolve(value)};
 socket.setTimeout(700);socket.once('connect',()=>socket.write('*1\r\n$4\r\nPING\r\n'));socket.once('data',data=>finish(data.toString().startsWith('+PONG')));socket.once('error',()=>finish(false));socket.once('timeout',()=>finish(false));
})}
if(await ping()){console.log('Redis 缓存已就绪（127.0.0.1:6381）。');process.exit(0)}
const binary=process.env.REDIS_SERVER_PATH||path.join(directory,'bin/redis-server');
await access(binary).catch(()=>{throw Error('未找到 Redis 服务，请安装 Redis 并设置 REDIS_URL，或将 redis-server 放入 .local/redis/bin。')});
await mkdir(path.join(directory,'data'),{recursive:true,mode:0o700});
const quoted=value=>'"'+value.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"';
const config=['bind 127.0.0.1','protected-mode yes','port 6381','daemonize yes','appendonly yes','appendfsync everysec','save ""',`dir ${quoted(path.join(directory,'data'))}`,`pidfile ${quoted(path.join(directory,'redis.pid'))}`,`logfile ${quoted(path.join(directory,'redis.log'))}`].join('\n')+'\n';
const configFile=path.join(directory,'redis.conf');await writeFile(configFile,config,{mode:0o600});
const result=spawnSync(binary,[configFile],{encoding:'utf8'});if(result.status!==0)throw Error('Redis 启动失败，请检查 .local/redis/redis.log。');
let ready=false;for(let attempt=0;attempt<20;attempt++){if(await ping()){ready=true;break}await delay(100)}
if(!ready)throw Error('Redis 启动后未响应。');console.log('Redis 缓存已启动（127.0.0.1:6381，AOF 持久化）。');
