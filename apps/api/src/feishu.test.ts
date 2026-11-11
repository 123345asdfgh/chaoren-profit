import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import {afterEach,describe,expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm,readFile,stat,readdir,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {FeishuService,officialAuthUrl,registerFeishuRoutes,tableLink,migrateLegacyAppSecrets,authorizationFailure,runCli,type CliRunner} from './feishu.js';
import {settingsIdentity} from './user-settings.js';

const cleanup:Array<()=>Promise<unknown>>=[];
afterEach(async()=>{await Promise.allSettled(cleanup.splice(0).reverse().map(fn=>fn()))});
const ok=(data:unknown)=>({stdout:JSON.stringify({ok:true,data}),exitCode:0});
async function fixture(handler?:(args:string[],env:NodeJS.ProcessEnv)=>Promise<ReturnType<typeof ok>>|ReturnType<typeof ok>){
 const root=await mkdtemp(path.join(tmpdir(),'profit-feishu-'));cleanup.push(()=>rm(root,{recursive:true,force:true}));
 const calls:{args:string[];env:NodeJS.ProcessEnv}[]=[];
 const runner:CliRunner=async(_binary,args,env)=>{
  calls.push({args,env});
  if(args[0]==='auth'&&args[1]==='status')return ok({identities:{user:{available:true,userName:'测试用户'}}});
  if(args[1]==='+base-get')return ok({base:{name:'2026年10月寄样文件'}});
  if(handler)return handler(args,env);
  return ok({tables:[{id:'tbl_a',name:'寄样表'}]});
 };
 const service=new FeishuService({FEISHU_STATE_ROOT:root,FEISHU_CLI_PATH:process.execPath},runner);cleanup.push(()=>service.close());
 await service.status('alice');
 const {readdir}=await import('node:fs/promises');
 const ownerDir=path.join(root,(await readdir(root))[0],'config');await mkdir(ownerDir,{recursive:true});await writeFile(path.join(ownerDir,'config.json'),'{}');
 return {service,calls,root};
}

describe('Feishu link boundary',()=>{
 it('accepts official table/wiki links and extracts the selected table',()=>{
  expect(tableLink('https://tenant.feishu.cn/base/base123?table=tbl_a&view=vew_x')).toMatchObject({kind:'base',token:'base123',selected:'tbl_a'});
  expect(tableLink('https://tenant.larkoffice.com/sheets/sheetToken?sheet=sh_1')).toMatchObject({kind:'sheets',selected:'sh_1'});
  expect(tableLink('https://tenant.feishu.cn/wiki/wikiToken')).toMatchObject({kind:'wiki'});
 });
 it('rejects external URLs, shell-like tokens, local files and credentials',()=>{
  for(const value of ['file:///etc/passwd','http://tenant.feishu.cn/base/x','https://feishu.cn.evil.test/base/x','https://evil.test/base/x','https://u:p@tenant.feishu.cn/base/x','https://tenant.feishu.cn:3002/base/x','https://tenant.feishu.cn/base/--help','https://tenant.feishu.cn/base/a;rm']){
   expect(()=>tableLink(value)).toThrow();
  }
 });
 it('only exposes validated official authorization URLs',()=>{
  expect(officialAuthUrl('https://accounts.feishu.cn/oauth/device?code=abc')).toBeTruthy();
  for(const value of ['https://evil.test/?token=x','https://open.feishu.cn.evil.test','https://u:p@accounts.feishu.cn/','http://accounts.feishu.cn/','https://accounts.feishu.cn:443/\nsecret'])expect(officialAuthUrl(value)).toBeUndefined();
 });
});

describe('table reading through fixed CLI commands',()=>{
 it('reads every Base page and preserves typed cell values',async()=>{
  const {service,calls}=await fixture(args=>{
   const offset=Number(args[args.indexOf('--offset')+1]);
   return ok({fields:['达人','寄样数量'],data:offset===0?[['甲',2],['乙',0]]:[['丙',3]],record_id_list:[],has_more:offset===0,rev:1});
  });
  const result=await service.read('alice','https://tenant.feishu.cn/base/base123','tbl_a');
  expect(result).toMatchObject({columns:['达人','寄样数量'],rows:[['甲',2],['乙',0],['丙',3]],complete:true});
  const reads=calls.filter(call=>call.args[1]==='+record-list');expect(reads).toHaveLength(2);expect(reads[1].args).toContain('2');
  for(const {args,env} of reads){expect(args.slice(0,2)).toEqual(['base','+record-list']);expect(args.slice(-4)).toEqual(['--as','user','--format','json']);expect(env.LARKSUITE_CLI_STRICT_MODE).toBe('user');expect(args).not.toContain('--view-id')}
 });
 it('does not falsely report success when a later page fails',async()=>{
  const {service}=await fixture(args=>args.includes('0')?ok({fields:['名字'],data:[['甲']],has_more:true}):{stdout:JSON.stringify({ok:false,error:'permission denied, SECRET_TOKEN'}),exitCode:1});
  await expect(service.read('alice','https://tenant.feishu.cn/base/base123','tbl_a')).rejects.toThrow('飞书读取失败');
 });
 it('stops instead of looping when the page or schema is inconsistent',async()=>{
  const {service}=await fixture(args=>ok({fields:args.includes('0')?['名字']:['其他列'],data:[['甲']],has_more:true}));
  await expect(service.read('alice','https://tenant.feishu.cn/base/base123','tbl_a')).rejects.toThrow('字段发生变化');
  const empty=await fixture(()=>ok({fields:['名字'],data:[],has_more:true}));
  await expect(empty.service.read('alice','https://tenant.feishu.cn/base/base123','tbl_a')).rejects.toThrow('分页未继续推进');
 });
 it('flags omitted fields instead of claiming the whole table was read',async()=>{
  const {service}=await fixture(()=>ok({fields:['可见'],data:[['甲']],has_more:false,ignored_fields:[{name:'隐藏字段'}]}));
  expect(await service.read('alice','https://tenant.feishu.cn/base/base123','tbl_a')).toMatchObject({complete:false,warning:expect.stringContaining('部分字段')});
 });
 it('discovers multiple tables without silently choosing the first',async()=>{
  const {service}=await fixture(()=>ok({tables:[{id:'tbl_a',name:'寄样表'},{id:'tbl_b',name:'明细表'}]}));
  expect(await service.tables('alice','https://tenant.feishu.cn/base/base123')).toMatchObject({documentName:'2026年10月寄样文件',selected:'',tables:expect.any(Array)});
  expect(await service.tables('alice','https://tenant.feishu.cn/base/base123?table=tbl_b')).toMatchObject({selected:'tbl_b'});
 });
 it('resolves Wiki sheets and reads only the selected worksheet',async()=>{
  const {service,calls}=await fixture(args=>{
   if(args[0]==='wiki')return ok({node:{obj_type:'sheet',obj_token:'sheet123'}});
   if(args[1]==='+workbook-info')return ok({sheets:[{sheet_id:'sh_1',title:'寄样'}]});
   return ok({sheets:[{name:'寄样',columns:['达人','数量'],data:[['甲',1]]}]});
  });
  expect(await service.tables('alice','https://tenant.feishu.cn/wiki/wiki123')).toMatchObject({kind:'sheets',selected:'sh_1'});
  expect(await service.read('alice','https://tenant.feishu.cn/wiki/wiki123','sh_1')).toMatchObject({rows:[['甲',1]],complete:true});
  expect(calls.at(-1)?.args).toContain('sheet123');expect(calls.at(-1)?.args).toContain('--sheet-id');
 });
 it('marks truncated Sheets output as partial',async()=>{
  const {service}=await fixture(()=>ok({truncated:true,sheets:[{name:'大表',columns:['名字'],data:[['甲']]}]}));
  expect(await service.read('alice','https://tenant.feishu.cn/sheets/sheet123','sh_1')).toMatchObject({complete:false,warning:expect.any(String)});
 });
 it('retains the real Chinese document title independently from the worksheet name',async()=>{
  const {service}=await fixture(args=>{
   if(args[0]==='wiki')return ok({node:{obj_type:'sheet',obj_token:'sheet123',title:'10月达人跟进表'}});
   if(args[1]==='+workbook-info')return ok({title:'10月达人跟进表',sheets:[{sheet_id:'sh_1',sheet_name:'sheet1'}]});
   return ok({sheets:[{name:'sheet1',columns:['日期'],data:[[6]]}]});
  });
  expect(await service.tables('alice','https://tenant.feishu.cn/wiki/wiki123')).toMatchObject({documentName:'10月达人跟进表',tables:[{id:'sh_1',name:'sheet1'}]});
  expect(await service.read('alice','https://tenant.feishu.cn/wiki/wiki123','sh_1')).toMatchObject({documentName:'10月达人跟进表',name:'sheet1'});
 });
 it('pushes a strict natural-month filter into Base and follows next_offset',async()=>{
  const {service,calls}=await fixture(args=>{
   const offset=Number(args[args.indexOf('--offset')+1]);
   return ok({fields:['日期'],data:[[offset?'2026-11-01':'2026-09-01']],has_more:offset===0,next_offset:offset===0?200:undefined,rev:1});
  });
  await service.read('alice','https://tenant.feishu.cn/base/base123','tbl_a',{dateRange:{field:'日期',from:'2026-09-01',to:'2026-12-01'}});
  const reads=calls.filter(c=>c.args[1]==='+record-list');expect(reads[1].args[reads[1].args.indexOf('--offset')+1]).toBe('200');
  const filter=JSON.parse(reads[0].args[reads[0].args.indexOf('--filter-json')+1]);
  expect(filter.conditions).toEqual([['日期','>','ExactDate(2026-08-31 23:59:59.999)'],['日期','<','ExactDate(2026-12-01 00:00:00)']]);
 });
 it('cannot use another visitor’s configured session',async()=>{
  const {service,calls}=await fixture();
  await service.tables('alice','https://tenant.feishu.cn/base/base123');
  await expect(service.tables('bob','https://tenant.feishu.cn/base/base123')).rejects.toThrow('请先连接');
  expect(calls.filter(call=>call.args[1]==='+table-list')).toHaveLength(1);
  expect(calls[0].env.LARKSUITE_CLI_CONFIG_DIR).toContain('/config');
  expect(calls[0].env.LARKSUITE_CLI_APP_ID).toBeUndefined();expect(calls[0].env.LARKSUITE_CLI_USER_ACCESS_TOKEN).toBeUndefined();
 });
});

describe('authorization and HTTP interface',()=>{
 it('runs QR generation inside the private profile allowed by the official CLI',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'profit-feishu-qr-'));cleanup.push(()=>rm(root,{recursive:true,force:true}));
  const png=Buffer.from([137,80,78,71,13,10,26,10]);let qrFile='';
  const runner:CliRunner=async(_binary,args,env,signal,onOutput,workingDirectory)=>{
   if(args[0]==='config'){
    onOutput?.('https://open.feishu.cn/page/cli?user_code=test\n','stdout');
    await new Promise<void>(resolve=>signal?.addEventListener('abort',()=>resolve(),{once:true}));return ok({});
   }
   if(args[1]==='qrcode'){
    qrFile=args[args.indexOf('--output')+1];
    expect(path.dirname(qrFile)).toBe(workingDirectory);
    expect(path.dirname(env.LARKSUITE_CLI_CONFIG_DIR!)).toBe(workingDirectory);
    const result=await runCli(process.execPath,['-e','process.stdout.write(process.cwd());process.stderr.write("diagnostic")'],env,undefined,undefined,workingDirectory);
    expect(result).toMatchObject({stdout:await realpath(workingDirectory!),stderr:'diagnostic',exitCode:0});
    await writeFile(qrFile,png);return ok({});
   }
   return ok({});
  };
  const service=new FeishuService({FEISHU_STATE_ROOT:root,FEISHU_CLI_PATH:process.execPath},runner);cleanup.push(()=>service.close());
  await service.start('alice');
  await expect.poll(async()=>JSON.stringify(await service.status('alice'))).toContain('user_code=test');
  expect(await service.qrcode('alice')).toEqual(png);
  expect((await stat(qrFile)).mode&0o777).toBe(0o600);
  await expect(service.qrcode('bob')).rejects.toThrow('授权链接尚未就绪');
 });
 it('recovers only this profile’s encrypted legacy app secret without overwriting credentials',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'profit-feishu-migration-'));cleanup.push(()=>rm(root,{recursive:true,force:true}));
  const legacy=path.join(root,'legacy'),official=path.join(root,'official'),config=path.join(root,'config.json');
  await mkdir(legacy);await mkdir(official);
  await writeFile(config,JSON.stringify({apps:[{appId:'cli_owned'},{appId:'cli_existing'},{appId:'../../escape'}]}));
  await writeFile(path.join(legacy,'appsecret_cli_owned.enc'),'encrypted-owned-secret');
  await writeFile(path.join(legacy,'appsecret_cli_other.enc'),'other-profile');
  await writeFile(path.join(legacy,'cli_owned_user.enc'),'user-token');
  await writeFile(path.join(legacy,'appsecret_cli_existing.enc'),'old-secret');
  await writeFile(path.join(official,'appsecret_cli_existing.enc'),'current-secret');
  await migrateLegacyAppSecrets(config,legacy,official);
  expect(await readFile(path.join(official,'appsecret_cli_owned.enc'),'utf8')).toBe('encrypted-owned-secret');
  expect(await readFile(path.join(legacy,'appsecret_cli_owned.enc'),'utf8')).toBe('encrypted-owned-secret');
  expect(await readFile(path.join(official,'appsecret_cli_existing.enc'),'utf8')).toBe('current-secret');
  expect((await readdir(official)).sort()).toEqual(['appsecret_cli_existing.enc','appsecret_cli_owned.enc']);
  expect((await stat(path.join(official,'appsecret_cli_owned.enc'))).mode&0o777).toBe(0o600);
  await expect(migrateLegacyAppSecrets(config,legacy,official)).resolves.toBeUndefined();
 });
 it('identifies the real missing-secret failure without exposing CLI output',()=>{
  const result={stdout:'',stderr:JSON.stringify({ok:false,error:{message:'device authorization failed: The request is missing a required parameter: client_secret. SECRET_VALUE'}}),exitCode:3};
  expect(authorizationFailure(result)).toContain('应用凭证');
  expect(authorizationFailure(result)).not.toContain('SECRET_VALUE');
  expect(authorizationFailure({stdout:'',stderr:'raw access_token=SECRET_VALUE',exitCode:3})).not.toContain('SECRET_VALUE');
 });
 it('waits for a cancelled login to stop before logout and never advances to account authorization',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'profit-feishu-cancel-'));cleanup.push(()=>rm(root,{recursive:true,force:true}));
  const commands:string[][]=[];let configStarted=false;let configStopped=false;
  const runner:CliRunner=async(_binary,args,env,signal)=>{
   commands.push(args);
   if(args[0]==='config'){
    configStarted=true;await new Promise<void>(resolve=>signal?.addEventListener('abort',()=>resolve(),{once:true}));
    await mkdir(env.LARKSUITE_CLI_CONFIG_DIR!,{recursive:true});await writeFile(path.join(env.LARKSUITE_CLI_CONFIG_DIR!,'config.json'),'{}');configStopped=true;return ok({});
   }
   if(args[1]==='logout')expect(configStopped).toBe(true);
   return ok({identities:{user:{available:false}}});
  };
  const service=new FeishuService({FEISHU_STATE_ROOT:root,FEISHU_CLI_PATH:process.execPath},runner);cleanup.push(()=>service.close());
  await service.start('alice');await expect.poll(()=>configStarted).toBe(true);
  await expect(service.disconnect('alice')).resolves.toEqual({connected:false});
  expect(commands.some(args=>args[1]==='login')).toBe(false);expect(commands.some(args=>args[1]==='logout')).toBe(true);
  expect(await service.status('alice')).toMatchObject({connected:false});
 });
 it('streams both authorization steps without exposing credentials and rejects duplicate logins',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'profit-feishu-auth-'));cleanup.push(()=>rm(root,{recursive:true,force:true}));
  let finishConfig:()=>void=()=>{};let finishLogin:()=>void=()=>{};let loggedIn=false;
  const runner:CliRunner=async(_binary,args,env,signal,onOutput)=>{
   if(args[0]==='config'){
    onOutput?.('  https://accounts.feishu.cn/config?code=first\n','stderr');
    await new Promise<void>(resolve=>{finishConfig=resolve;signal?.addEventListener('abort',()=>resolve(),{once:true})});
    await mkdir(env.LARKSUITE_CLI_CONFIG_DIR!,{recursive:true});await writeFile(path.join(env.LARKSUITE_CLI_CONFIG_DIR!,'config.json'),'{}');return ok({});
   }
   if(args[1]==='login'){
    expect(args).not.toContain('--recommend');expect(args[args.indexOf('--scope')+1]).not.toMatch(/write|send|delete/);
    onOutput?.('{"verification_uri_complete":"https://evil.test/secret"}\n','stdout');
    onOutput?.('{"verification_uri_complete":"https://accounts.feishu.cn/auth?code=second"}\n','stdout');
    await new Promise<void>(resolve=>{finishLogin=resolve;signal?.addEventListener('abort',()=>resolve(),{once:true})});loggedIn=true;return ok({access_token:'DO_NOT_EXPOSE'});
   }
   return ok({identities:{user:{available:loggedIn,userName:'测试用户'}}});
  };
  const service=new FeishuService({FEISHU_STATE_ROOT:root,FEISHU_CLI_PATH:process.execPath},runner);cleanup.push(()=>service.close());
  await service.start('alice');
  await expect(service.start('alice')).rejects.toThrow('尚未结束');
  await expect.poll(async()=>JSON.stringify(await service.status('alice'))).toContain('code=first');finishConfig();
  await expect.poll(async()=>JSON.stringify(await service.status('alice'))).toContain('code=second');finishLogin();
  await expect.poll(async()=>(await service.status('alice')).connected).toBe(true);
  expect(JSON.stringify(await service.status('alice'))).not.toContain('DO_NOT_EXPOSE');
 });
 it('serves no-store data, reuses the server identity cookie, and rejects arbitrary commands',async()=>{
  const {service}=await fixture();const app=Fastify();await app.register(cookie);
  app.setErrorHandler((error,_request,reply)=>reply.code((error as Error&{statusCode?:number}).statusCode||400).send({error:(error as Error).message}));
  registerFeishuRoutes(app,'/api/profit',settingsIdentity(),service);cleanup.push(()=>app.close());
  const response=await app.inject('/api/profit/feishu/status');expect(response.statusCode).toBe(200);expect(response.headers['cache-control']).toBe('no-store');expect(response.headers['set-cookie']).toContain('HttpOnly');
  const savedCookie=String(response.headers['set-cookie']).split(';')[0];
  const read=await app.inject({method:'POST',url:'/api/profit/feishu/read',headers:{cookie:savedCookie},payload:{url:'https://tenant.feishu.cn/base/base123',tableId:'tbl_a',args:['im','+send']}});expect(read.statusCode).toBe(400);
  expect((await app.inject({method:'POST',url:'/api/profit/feishu/run',payload:{args:['api','DELETE']}})).statusCode).toBe(404);
 });
});
