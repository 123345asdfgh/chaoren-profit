import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {access,chmod,copyFile,mkdir,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {StringDecoder} from 'node:string_decoder';
import type {FastifyInstance,FastifyReply,FastifyRequest} from 'fastify';
import {z} from 'zod';

const require=createRequire(import.meta.url);
const fail=(message:string,statusCode=400)=>Object.assign(new Error(message),{statusCode});
type Json=Record<string,any>;
type Result={stdout:string;stderr?:string;exitCode:number};
export type CliRunner=(binary:string,args:string[],env:NodeJS.ProcessEnv,signal?:AbortSignal,onOutput?:(text:string,stream:string)=>void,workingDirectory?:string)=>Promise<Result>;
export const runCli:CliRunner=(binary,args,env,signal,onOutput,workingDirectory)=>new Promise((resolve,reject)=>{
 const child=spawn(binary,args,{env,cwd:workingDirectory,stdio:['ignore','pipe','pipe'],signal});
 let stdout='',stderr='',size=0,failed=false;
 const decoders={stdout:new StringDecoder('utf8'),stderr:new StringDecoder('utf8')};
 const timer=setTimeout(()=>child.kill('SIGKILL'),onOutput?15*60_000:120_000);
 let killTimer:ReturnType<typeof setTimeout>|undefined;
 const abort=()=>{killTimer=setTimeout(()=>child.kill('SIGKILL'),1000)};
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 for(const [stream,pipe] of [['stdout',child.stdout],['stderr',child.stderr]] as const)pipe.on('data',(chunk:Buffer)=>{
  size+=chunk.length;
  if(size>16*1024*1024){failed=true;child.kill('SIGKILL');return}
  const value=decoders[stream].write(chunk);if(stream==='stdout')stdout+=value;else stderr+=value;onOutput?.(value,stream);
 });
 // Wait for close before releasing the user's lock: login may still be saving credentials.
 child.once('error',()=>{failed=true});
 child.once('close',code=>{clearTimeout(timer);clearTimeout(killTimer);signal?.removeEventListener('abort',abort);
  stdout+=decoders.stdout.end();
  stderr+=decoders.stderr.end();
  if(failed||code===null)reject(fail('飞书 CLI 未能完成，请重试。',502));else resolve({stdout,stderr,exitCode:code});
 });
});

/** Repair credentials created by the first integration before HOME was inherited.
 * The official macOS CLI used its relative fallback for encrypted files. Copy
 * only app secrets referenced by this profile; preserve originals and never
 * replace an existing system credential. The CLI still performs all decryption.
 */
export async function migrateLegacyAppSecrets(configFile:string,legacyDirectory:string,officialDirectory:string){
 let config:Json;try{config=JSON.parse(await readFile(configFile,'utf8'))}catch{return}
 for(const app of Array.isArray(config.apps)?config.apps:[]){
  if(typeof app.appId!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(app.appId))continue;
  const name='appsecret_'+app.appId+'.enc',source=path.join(legacyDirectory,name),target=path.join(officialDirectory,name);
  try{await access(source)}catch{continue}
  await mkdir(officialDirectory,{recursive:true,mode:0o700});
  try{await copyFile(source,target,constants.COPYFILE_EXCL);await chmod(target,0o600)}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error}
 }
}

export function authorizationFailure(result:Result){
 // Never return raw OAuth output, secrets, authorization codes or arbitrary CLI text.
 let message='';
 for(const output of [result.stderr,result.stdout]){
  if(!output)continue;
  try{const data=JSON.parse(output);if(typeof data.error?.message==='string')message+=' '+data.error.message}catch{}
 }
 if(/missing.*client_secret|client_secret.*required/i.test(message))return '飞书应用凭证未能读取，请重新连接；若仍失败，请检查应用凭证配置。';
 if(/keychain|keyring/i.test(message))return '无法访问系统钥匙串，请允许飞书 CLI 访问钥匙串后重新连接。';
 if(/invalid.scope|invalid_scope|scope.*not.*(valid|exist|support)/i.test(message))return '飞书未接受表格读取权限，请检查应用权限后重新连接。';
 if(/dial tcp|no such host|timeout|network|connection refused/i.test(message))return '暂时无法连接飞书授权服务，请检查网络后重新连接。';
 return '飞书授权未完成，请重新连接并检查飞书页面提示。';
}

export function officialAuthUrl(value:string){
 try{const u=new URL(value);return !/[\s\x00-\x1f]/u.test(value)&&u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&['accounts.feishu.cn','open.feishu.cn','accounts.larksuite.com','open.larksuite.com'].includes(u.hostname)?value:undefined}catch{return undefined}
}
export function tableLink(value:string){
 let url:URL;try{url=new URL(value)}catch{throw fail('请输入完整的飞书表格链接。')}
 if(url.protocol!=='https:'||url.port||url.username||url.password||!/(^|\.)(feishu\.cn|larksuite\.com|larkoffice\.com)$/i.test(url.hostname))throw fail('请使用飞书或 Lark 的官方表格链接。');
 const match=url.pathname.match(/^\/(base|sheets|wiki)\/([A-Za-z0-9][A-Za-z0-9_-]*)\/?$/);
 if(!match)throw fail('请粘贴多维表格、电子表格或知识库中的表格链接。');
 return {url:url.href,kind:match[1],token:match[2],selected:url.searchParams.get(match[1]==='sheets'?'sheet':'table')||''};
}
function payload(result:Result):Json{
 let value:Json;try{value=JSON.parse(result.stdout)}catch{throw fail('飞书返回的数据格式异常，请重试。',502)}
 if(result.exitCode!==0||value.ok===false||(typeof value.code==='number'&&value.code!==0))throw fail('飞书读取失败，请确认账号有该表的访问权限，并已授权表格读取权限。',422);
 return value.data&& !Array.isArray(value.data)&&typeof value.data==='object'?value.data:value;
}
type Phase='configuring'|'authorizing'|'completed'|'failed'|'cancelled';
type Pending={phase:Phase;authorizationUrl?:string;reason?:string;expiresAt:number};
type Session={pending:Pending;controller:AbortController;done:Promise<void>};
export type ReadTable={name:string;documentName?:string;columns:string[];rows:unknown[][];recordIds?:string[];complete:boolean;warning?:string};
export type ReadOptions={dateRange?:{field:string;from:string;to:string}};
const idSchema=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/);
const scopes='offline_access base:record:read base:table:read sheets:spreadsheet:read wiki:node:retrieve';

/** Runs only fixed read commands. Credentials remain with the official CLI, per visitor/host user. */
export class FeishuService{
 private sessions=new Map<string,Session>();
 private busy=new Set<string>();
 private reads=new Set<AbortController>();
 private binary:string;
 private root:string;
 constructor(private env:NodeJS.ProcessEnv=process.env,private runner:CliRunner=runCli){
  this.binary=env.FEISHU_CLI_PATH||path.join(path.dirname(require.resolve('@larksuite/cli/package.json')),'bin',process.platform==='win32'?'lark-cli.exe':'lark-cli');
  this.root=path.resolve(env.FEISHU_STATE_ROOT||fileURLToPath(new URL('../../../.local/feishu/',import.meta.url)));
 }
 private async profile(owner:string){
  const directory=path.join(this.root,createHash('sha256').update(owner).digest('hex'));
  await mkdir(directory,{recursive:true,mode:0o700});await chmod(directory,0o700);
  if(process.platform==='darwin'&&process.env.HOME)await migrateLegacyAppSecrets(
   path.join(directory,'config','config.json'),
   fileURLToPath(new URL('../.lark-cli/keychain/lark-cli/',import.meta.url)),
   path.join(process.env.HOME,'Library','Application Support','lark-cli')
  );
  // Explicit CLI directories prevent using the machine's or main project's login.
  const env:NodeJS.ProcessEnv={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,LANG:'zh_CN.UTF-8',LARKSUITE_CLI_CONFIG_DIR:path.join(directory,'config'),LARKSUITE_CLI_DATA_DIR:path.join(directory,'data'),LARKSUITE_CLI_LOG_DIR:path.join(directory,'logs'),LARKSUITE_CLI_BRAND:'feishu',LARKSUITE_CLI_DEFAULT_AS:'user'};
  return {directory,env};
 }
 private async configured(env:NodeJS.ProcessEnv){try{await access(path.join(env.LARKSUITE_CLI_CONFIG_DIR!,'config.json'));return true}catch{return false}}
 private async account(env:NodeJS.ProcessEnv){
  if(!await this.configured(env))return {connected:false};
  const data=payload(await this.runner(this.binary,['auth','status','--json'],env));
  return {connected:data.identities?.user?.available===true,displayName:typeof data.identities?.user?.userName==='string'?data.identities.user.userName:undefined};
 }
 async status(owner:string){
  try{await access(this.binary)}catch{return {installed:false,connected:false,reason:'飞书 CLI 尚未安装，请运行 pnpm install。'}}
  const session=this.sessions.get(owner);
  if(session&&['configuring','authorizing'].includes(session.pending.phase))return {installed:true,connected:false,pending:session.pending};
  if(this.busy.has(owner))return {installed:true,connected:true,busy:true};
  const profile=await this.profile(owner);const account=await this.account(profile.env);
  return {installed:true,...account,...(!account.connected&&session?{pending:session.pending}:{})};
 }
 async start(owner:string){
  if(this.busy.has(owner))throw fail('当前飞书操作尚未结束，请稍后再试。',409);
  await access(this.binary).catch(()=>{throw fail('飞书 CLI 尚未安装。',503)});
  // Reserve synchronously before any profile/network work.
  if(this.busy.has(owner))throw fail('当前飞书操作尚未结束，请稍后再试。',409);
  this.busy.add(owner);
  const session:Session={pending:{phase:'configuring',expiresAt:Date.now()+15*60_000},controller:new AbortController(),done:Promise.resolve()};
  this.sessions.set(owner,session);
  session.done=this.authorize(owner,session);
  return {installed:true,connected:false,pending:session.pending};
 }
 private async authorize(owner:string,session:Session){
  const timer=setTimeout(()=>session.controller.abort(),15*60_000);timer.unref();
  try{
   const profile=await this.profile(owner);
   for(const phase of ['configuring','authorizing'] as const){
    if(session.controller.signal.aborted)throw fail('已取消');
    if(phase==='configuring'&&await this.configured(profile.env))continue;
    session.pending={phase,expiresAt:session.pending.expiresAt};
    const buffers:Record<string,string>={stdout:'',stderr:''};
    const consume=(text:string,stream:string)=>{
     const lines=(buffers[stream]+text).slice(-64000).split(/\r?\n/u);buffers[stream]=lines.pop()||'';
     for(const line of lines){
      let candidates:string[]=[];
      try{const data=JSON.parse(line);candidates=[data.verification_uri_complete,data.verification_url].filter(x=>typeof x==='string')}catch{if(/^\s*https:\/\/\S+\s*$/u.test(line))candidates=[line.trim()]}
      for(const candidate of candidates){const valid=officialAuthUrl(candidate);if(valid)session.pending.authorizationUrl=valid}
     }
    };
    const result=await this.runner(this.binary,phase==='configuring'?['config','init','--new','--brand','feishu','--lang','zh']:['auth','login','--scope',scopes,'--json'],profile.env,session.controller.signal,consume);
    consume('\n','stdout');consume('\n','stderr');
    if(result.exitCode!==0)throw Object.assign(fail(authorizationFailure(result)),{safeAuthorizationReason:true});
   }
   if(session.controller.signal.aborted||!(await this.account(profile.env)).connected)throw fail('授权未完成');
   session.pending={phase:'completed',expiresAt:session.pending.expiresAt};
  }catch(error){
   const reason=error instanceof Error&&(error as Error&{safeAuthorizationReason?:boolean}).safeAuthorizationReason===true?error.message:'飞书授权未完成，请重新连接并检查飞书页面提示。';
   session.pending={phase:session.controller.signal.aborted?'cancelled':'failed',expiresAt:session.pending.expiresAt,reason:session.controller.signal.aborted?'登录已取消或过期，可重新连接。':reason};
  }finally{clearTimeout(timer);this.busy.delete(owner)}
 }
 async disconnect(owner:string){
  const session=this.sessions.get(owner);
  if(session&&['configuring','authorizing'].includes(session.pending.phase)){session.controller.abort();await session.done}
  if(this.busy.has(owner))throw fail('表格正在读取，请结束后再退出。',409);
  this.busy.add(owner);
  try{const profile=await this.profile(owner);if(await this.configured(profile.env)){
   const result=await this.runner(this.binary,['auth','logout','--json'],profile.env);
   if(result.exitCode!==0)throw fail('退出失败，请重试。',502);
  }this.sessions.delete(owner);return {connected:false}}finally{this.busy.delete(owner)}
 }
 async qrcode(owner:string){
  const session=this.sessions.get(owner),url=session?.pending.authorizationUrl;
  if(!session||!['configuring','authorizing'].includes(session.pending.phase)||!url||!officialAuthUrl(url))throw fail('授权链接尚未就绪或已失效。',404);
  const profile=await this.profile(owner),file=path.join(profile.directory,'qr-'+createHash('sha256').update(url).digest('hex')+'.png');
  // The official CLI allows QR output under its cwd. Keep the process inside
  // this private profile rather than broadening its file access allowlist.
  try{await access(file)}catch{const result=await this.runner(this.binary,['auth','qrcode',url,'--output',file],profile.env,undefined,undefined,profile.directory);if(result.exitCode!==0)throw fail('二维码生成失败，请使用授权链接。',502);await chmod(file,0o600)}
  return readFile(file);
 }
 private async withReader<T>(owner:string,action:(call:(args:string[])=>Promise<Json>)=>Promise<T>){
  if(this.busy.has(owner))throw fail('当前飞书操作尚未结束，请稍后再试。',409);
  this.busy.add(owner);const controller=new AbortController();this.reads.add(controller);
  const timer=setTimeout(()=>controller.abort(),5*60_000);timer.unref();
  try{const profile=await this.profile(owner);
   if(!(await this.account(profile.env)).connected)throw fail('请先连接自己的飞书账号。',401);
   return await action(async args=>{
    if(controller.signal.aborted)throw fail('表格读取超时，请稍后重试。',504);
    return payload(await this.runner(this.binary,[...args,'--as','user','--format','json'],{...profile.env,LARKSUITE_CLI_STRICT_MODE:'user'},controller.signal));
   });
  }finally{clearTimeout(timer);this.reads.delete(controller);this.busy.delete(owner)}
 }
 private async resolve(link:string,call:(args:string[])=>Promise<Json>){
  const source={...tableLink(link),documentName:''};
  if(source.kind==='wiki'){
   const value=await call(['wiki','+node-get','--node-token',source.url]),node=value.node||value;
   if(!['bitable','sheet'].includes(node.obj_type)||!idSchema.safeParse(node.obj_token).success)throw fail('这个知识库链接不是多维表格或电子表格。');
   source.kind=node.obj_type==='sheet'?'sheets':'base';source.token=node.obj_token;source.documentName=typeof node.title==='string'?node.title:'';
  }
  return source;
 }
 async tables(owner:string,link:string){
  tableLink(link);
  return this.withReader(owner,async call=>{
   const source=await this.resolve(link,call);
   const data=await call(source.kind==='base'?['base','+table-list','--base-token',source.token]:['sheets','+workbook-info','--spreadsheet-token',source.token]);
   const raw=source.kind==='base'?data.tables:data.sheets;
   if(!Array.isArray(raw))throw fail('无法识别表格中的工作表。',502);
   if(source.kind==='base'&&!source.documentName){const metadata=await call(['base','+base-get','--base-token',source.token]);source.documentName=String(metadata.base?.name||metadata.name||metadata.title||'')}
   const tables=raw.map((table:Json)=>({id:String(table.id||table.table_id||table.sheet_id||''),name:String(table.name||table.sheet_name||table.title||table.id||table.sheet_id||'未命名')})).filter(table=>idSchema.safeParse(table.id).success);
   return {kind:source.kind,documentName:String(data.title||source.documentName||''),tables,selected:tables.some(t=>t.id===source.selected)?source.selected:tables.length===1?tables[0].id:''};
  });
 }
 async read(owner:string,link:string,tableId:string,options:ReadOptions={}):Promise<ReadTable>{
  tableLink(link);idSchema.parse(tableId);
  return this.withReader(owner,async call=>{
   const source=await this.resolve(link,call);
   if(source.kind==='sheets'){
    const metadata=await call(['sheets','+workbook-info','--spreadsheet-token',source.token]);
    const documentName=String(metadata.title||source.documentName||'');
    const data=await call(['sheets','+table-get','--spreadsheet-token',source.token,'--sheet-id',tableId,'--max-chars','8000000']);
    if(!Array.isArray(data.sheets)||data.sheets.length!==1)throw fail('没有找到所选工作表。',422);
    const sheet=data.sheets[0];
    if(!Array.isArray(sheet.columns)||!Array.isArray(sheet.data)||!sheet.data.every(Array.isArray))throw fail('工作表返回的数据格式异常。',502);
    const incomplete=data.truncated===true||data.complete===false||sheet.truncated===true;
    return {name:String(sheet.name||sheet.sheet_name||tableId),documentName,columns:sheet.columns.map(String),rows:sheet.data,complete:!incomplete,...(incomplete?{warning:'表格超过单次读取容量，目前为部分数据，请缩小表格后重读。'}:{})} satisfies ReadTable;
   }
   if(!source.documentName&&!options.dateRange){const metadata=await call(['base','+base-get','--base-token',source.token]);source.documentName=String(metadata.base?.name||metadata.name||metadata.title||'')}
   const rows:unknown[][]=[],recordIds:string[]=[];let columns:string[]|undefined;let offset=0;let totalBytes=0;let revision:unknown;let omittedFields=false;
   const filterArgs:string[]=[];
   if(options.dateRange){
    const {field,from,to}=options.dateRange;z.iso.date().parse(from);z.iso.date().parse(to);
    const previous=new Date(Date.parse(from+'T00:00:00Z')-86400000).toISOString().slice(0,10);
    filterArgs.push('--filter-json',JSON.stringify({logic:'and',conditions:[[field,'>','ExactDate('+previous+' 23:59:59.999)'],[field,'<','ExactDate('+to+' 00:00:00)']]}));
   }
   while(true){
    const data=await call(['base','+record-list','--base-token',source.token,'--table-id',tableId,...filterArgs,'--offset',String(offset),'--limit','200']);
    // Official Base v3 returns a matrix with parallel fields/data/record_id_list arrays.
    if(!Array.isArray(data.fields)||!Array.isArray(data.data)||!data.data.every((row:unknown)=>Array.isArray(row)&&row.length===data.fields.length))throw fail('多维表格返回的数据格式异常。',502);
    const fields=data.fields.map(String);
    if(columns&&JSON.stringify(columns)!==JSON.stringify(fields))throw fail('读取期间表格字段发生变化，请重新读取。',409);
    if(offset&&revision!==undefined&&data.rev!==undefined&&revision!==data.rev)throw fail('读取期间表格内容发生变化，请重新读取。',409);
    if(Array.isArray(data.ignored_fields)&&data.ignored_fields.length)omittedFields=true;
    revision=data.rev;
    columns=fields;rows.push(...data.data);
    if(Array.isArray(data.record_id_list)&&data.record_id_list.length===data.data.length)recordIds.push(...data.record_id_list.map(String));
    totalBytes+=Buffer.byteLength(JSON.stringify(data.data));
    if(typeof data.has_more!=='boolean')throw fail('飞书未返回完整的分页状态，请重试。',502);
    if(!data.has_more)return {name:tableId,documentName:source.documentName,columns:columns!,rows,recordIds,complete:!omittedFields,...(omittedFields?{warning:'飞书未返回部分字段，请检查字段权限或不支持的字段类型。'}:{})} satisfies ReadTable;
    if(!data.data.length)throw fail('表格分页未继续推进，请重试。',502);
    const next=data.next_offset===undefined?offset+data.data.length:Number(data.next_offset);
    if(!Number.isSafeInteger(next)||next<=offset)throw fail('表格分页未继续推进，请重试。',502);
    offset=next;
    if(rows.length>=50000||totalBytes>24*1024*1024)return {name:tableId,documentName:source.documentName,columns:columns!,rows,recordIds,complete:false,warning:'表格超过单次读取容量，目前为部分数据（最多 50,000 行或 24 MB）。'} satisfies ReadTable;
   }
  });
 }
 async close(){for(const session of this.sessions.values())session.controller.abort();for(const controller of this.reads)controller.abort();await Promise.allSettled([...this.sessions.values()].map(session=>session.done))}
}

type Owner=(request:FastifyRequest,reply:FastifyReply)=>Promise<string>;
export function registerFeishuRoutes(app:FastifyInstance,prefix:string,owner:Owner,service=new FeishuService()){
 const route=prefix+'/feishu';
 app.addHook('onClose',async()=>service.close());
 app.addHook('onSend',async(request,reply,payload)=>{if(request.url.startsWith(route))reply.header('cache-control','no-store');return payload});
 app.get(route+'/status',async(request,reply)=>service.status(await owner(request,reply)));
 app.post(route+'/login',async(request,reply)=>service.start(await owner(request,reply)));
 app.post(route+'/disconnect',async(request,reply)=>service.disconnect(await owner(request,reply)));
 app.get(route+'/qrcode',async(request,reply)=>reply.type('image/png').send(await service.qrcode(await owner(request,reply))));
 app.post(route+'/tables',async(request,reply)=>{const body=z.strictObject({url:z.string().trim().min(1).max(2000)}).parse(request.body);return service.tables(await owner(request,reply),body.url)});
 app.post(route+'/read',async(request,reply)=>{const body=z.strictObject({url:z.string().trim().min(1).max(2000),tableId:idSchema}).parse(request.body);return service.read(await owner(request,reply),body.url,body.tableId)});
 return service;
}
