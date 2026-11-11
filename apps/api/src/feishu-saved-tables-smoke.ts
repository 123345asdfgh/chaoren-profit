// Real database + HTTP route checks; only the remote Feishu service is stubbed.
// A rollback removes every fixture, including when an assertion fails.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Fastify from 'fastify';
import {pool} from './db.js';
import {loadCatalogCosts} from './creator-sampling-costs.js';
import {settingsIdentity} from './user-settings.js';
import {CreatorSampling,registerCreatorSamplingRoutes} from './creator-sampling.js';
import {SavedFeishuTables,registerSavedFeishuTableRoutes} from './feishu-saved-tables.js';

const client=await pool.connect(),run=randomUUID();let currentUser='bookmark-a-'+run;
const costProduct='成本验证商品-'+run;
let authorized=true,revision=1,reads=0,dashboardMode=false;
const remote={
 async tables(){if(!authorized)throw Object.assign(Error('请先连接自己的飞书账号。'),{statusCode:401});return {kind:'base',documentName:'测试文件',tables:[{id:'tbl_a',name:'寄样主表'},{id:'tbl_b',name:'寄样明细'}],selected:'tbl_a'}},
 async read(owner:string,url:string,tableId:string){
  if(!authorized)throw Object.assign(Error('请先连接自己的飞书账号。'),{statusCode:401});
  if(dashboardMode){
   if(tableId==='tblHWhOsyNN1pYlH')return {name:'寄样统计表（天）',documentName:'主表文件',columns:['日期','达人名称','是否邮寄','寄样产品名称','寄样产品数量','品类','达人等级'],rows:[['2026-10-06','alice','是',costProduct,1,'盲盒','L2']],complete:true};
   return {name:'sheet1',documentName:'10月达人跟进表',columns:['日期','Buyer Username','备注'],rows:[[6,'alice','视频履约']],complete:true};
  }
  assert.ok(owner.startsWith('user:'));assert.equal(url,'https://tenant.feishu.cn/base/testBase');assert.equal(tableId,'tbl_a');
  reads++;return {name:tableId,columns:['版本'],rows:[[revision]],complete:true};
 }
};
let app=Fastify();
function register(){
 app.setErrorHandler((error,_request,reply)=>reply.code((error as any).statusCode || ((error as any).name==='ZodError'?400:500)).send({error:(error as Error).message}));
 const owner=settingsIdentity({resolveUserId:()=>currentUser,standalone:false});
 const store=new SavedFeishuTables(client,remote);
 registerSavedFeishuTableRoutes(app,'/api/profit',owner,store);
 registerCreatorSamplingRoutes(app,'/api/profit',owner,new CreatorSampling(store,()=>new Date('2026-11-06T08:00:00Z'),names=>loadCatalogCosts(client,names)));
}
const base='/api/profit/feishu/saved-tables';
try{
 await client.query('BEGIN');register();
 await client.query(`INSERT INTO profit.products(name,spec_code,attribute,snapshot) VALUES($1,$2,'盲盒',$3::jsonb)`,[costProduct,'cost-smoke-'+run,JSON.stringify({fields:{chinaPrice:'100',costRate:'99'}})]);
 const input={url:'https://tenant.feishu.cn/base/testBase?table=tbl_a&view=view_a',tableId:'tbl_a'};
 const initial=(await app.inject(base)).json().tables;assert.equal(initial.length,1);assert.equal(initial[0].sourceType,'primary');
 const first=await app.inject({method:'POST',url:base,payload:input});assert.equal(first.statusCode,200);
 const saved=first.json();assert.equal(saved.sourceType,'secondary');assert.equal(saved.documentName,'测试文件');assert.equal(saved.name,'寄样主表');assert.equal(saved.url,'https://tenant.feishu.cn/base/testBase');
 const duplicate=await app.inject({method:'POST',url:base,payload:{...input,url:input.url.replace('view_a','view_b')}});
 assert.equal(duplicate.json().id,saved.id,'view changes do not create duplicate bookmarks');
 await app.inject({method:'POST',url:base,payload:{...input,tableId:'tbl_b'}});
 assert.equal((await app.inject(base)).json().tables.length,3,'different tables are saved separately');
 const invalid=await app.inject({method:'POST',url:base,payload:{...input,tableId:'tbl_foreign'}});assert.equal(invalid.statusCode,400);
 assert.equal((await app.inject(base)).json().tables.length,3,'invalid selection is never saved');
 const read=()=>app.inject({method:'POST',url:base+'/'+saved.id+'/read',payload:{}});
 assert.deepEqual((await read()).json().rows,[[1]]);revision=2;
 assert.deepEqual((await read()).json().rows,[[2]],'each read fetches live data');
 const dashboard='/api/profit/creator-sampling';
 const sources=(await app.inject(dashboard+'/sources')).json();assert.equal(sources.tables.length,3);
 const automatic=()=>app.inject({method:'POST',url:dashboard+'/read',payload:{}});
 const select=(tableIds:string[])=>app.inject({method:'POST',url:dashboard+'/read',payload:{tableIds}});
 assert.equal((await select([saved.id,saved.id,saved.id,saved.id])).statusCode,400,'manual table selection is not accepted');
 assert.equal((await select([saved.id,saved.id])).statusCode,400,'legacy selection input is rejected');
 assert.equal((await select([initial[0].id])).statusCode,400,'primary selection input is rejected');
 currentUser='bookmark-b-'+run;assert.equal((await app.inject(base)).json().tables.length,1);
 dashboardMode=true;const empty=await automatic();assert.equal(empty.statusCode,200);assert.deepEqual(empty.json().source.months,[]);assert.deepEqual(empty.json().records,[]);dashboardMode=false;
 assert.equal((await select([saved.id])).statusCode,400,'another owner cannot select a saved source');
 assert.equal((await read()).statusCode,404,'another user cannot read a bookmark by guessing its ID');assert.equal(reads,2);
 const other=await app.inject({method:'POST',url:base,payload:input});assert.notEqual(other.json().id,saved.id);
 currentUser='bookmark-a-'+run;
 await app.close();app=Fastify();register();
 assert.equal((await app.inject(base)).json().tables.length,3,'bookmarks survive a new API/store instance');
 dashboardMode=true;
 const data=await automatic();assert.equal(data.statusCode,200);assert.equal(data.json().records[0].fulfilled,true);
 assert.equal(data.json().records[0].unitCostRmb,40,'cost uses the catalog combination price and fixed 40%, not its costRate');
 await client.query(`UPDATE profit.products SET snapshot=jsonb_set(snapshot,'{fields,chinaPrice}','"150"'::jsonb) WHERE name=$1`,[costProduct]);
 assert.equal((await automatic()).json().records[0].unitCostRmb,60,'next read uses the changed database price without cached cost data');
 assert.deepEqual(data.json().source.months,['2026-10']);assert.equal(data.json().source.secondaryCount,2);
 assert.equal((await app.inject(dashboard+'/sources')).json().mode,'automatic','sources use automatic mode without stored selections');
 dashboardMode=false;
 authorized=false;assert.equal((await read()).statusCode,401,'saved links do not bypass authorization');
 assert.equal((await app.inject(base)).json().tables.length,3,'logout preserves bookmarks');
 console.log('Saved Feishu tables smoke passed: persistence, deduplication, multiple tables, ownership, automatic months, empty sources and live reads.');
}finally{
 await app.close();await client.query('ROLLBACK');client.release();await pool.end();
 console.log('All smoke fixtures rolled back.');
}
