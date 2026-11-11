// Exercise the real HTTP and database path with two disposable visitor scopes.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {pool} from './db.js';

const port=3332,base=`http://127.0.0.1:${port}/api/profit`,fixture=randomUUID();
const server=spawn(process.execPath,['--import','tsx','src/server.ts'],{cwd:process.cwd(),env:{...process.env,API_PORT:String(port),LOG_LEVEL:'silent'},stdio:'ignore'});
const scopes:string[]=[],recordIds:string[]=[],productIds:string[]=[];
async function request(path:string,cookie='',method='GET',body?:unknown){
 const response=await fetch(base+path,{method,headers:{origin:'http://127.0.0.1:8081',cookie,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]||cookie};
}
function trackScope(cookie:string){scopes.push('standalone:'+createHash('sha256').update(cookie.split('=')[1]).digest('hex'))}
function trackRecord(data:{id:string;productId:string}){recordIds.push(data.id);productIds.push(data.productId)}
const template=(await pool.query('SELECT fields,updated_at FROM profit.global_settings WHERE id=1')).rows;
try{
 let ready=false;for(let attempt=0;attempt<40;attempt++){try{ready=(await request('/health')).status===200;if(ready)break}catch{}await delay(100)}assert.ok(ready,'test API ready');
 const a=await request('/settings'),b=await request('/settings');trackScope(a.cookie);trackScope(b.cookie);
 assert.equal(a.status,200);assert.equal(a.data.hasPersonalDefaults,false);assert.deepEqual(a.data.fields,b.data.fields);assert.notEqual(a.cookie,b.cookie);
 assert.equal((await request('/settings',a.cookie,'PUT',{fields:{promotion:'22',fx:'7.2'}})).status,200);
 assert.equal((await request('/settings',a.cookie)).data.fields.promotion,'22');assert.deepEqual((await request('/settings',b.cookie)).data.fields,b.data.fields);
 const fields={...a.data.fields,fx:'7.2',promotion:'23',operation:'18',chinaPrice:'100',salePrice:'40',buyerShipping:'0',receipt:'40',logistics:'70',currency:'RMB'};
 const first=await request('/records',a.cookie,'POST',{specCode:'defaults-A-'+fixture,snapshot:{fields},defaultFields:{promotion:'23',operation:'18'}});
 assert.equal(first.status,201);trackRecord(first.data);assert.equal(first.data.defaults.fields.promotion,'23');assert.equal(first.data.defaults.fields.fx,'7.2');
 const comparison=await request('/records/'+first.data.id,a.cookie,'PATCH',{specCode:'defaults-A-'+fixture,snapshot:{fields:{...fields,promotion:'55'}}});
 assert.equal(comparison.status,200);assert.equal(comparison.data.snapshot.fields.promotion,'55');assert.equal(comparison.data.snapshot.input.promotion,55);assert.equal(comparison.data.defaults,undefined);
 assert.equal((await request('/settings',a.cookie)).data.fields.promotion,'23');
 assert.equal((await request('/records/'+first.data.id,b.cookie)).data.snapshot.fields.promotion,'55','history remains shared');
 const second=await request('/records',b.cookie,'POST',{specCode:'defaults-B-'+fixture,defaultFields:{}});
 assert.equal(second.status,201);trackRecord(second.data);assert.equal(second.data.netRmb,null);assert.deepEqual(second.data.defaults.fields,b.data.fields);
 const c=await request('/settings');trackScope(c.cookie);
 const firstComparison=await request('/records',c.cookie,'POST',{specCode:'defaults-C-'+fixture,snapshot:{fields:{...fields,promotion:'55'}}});
 assert.equal(firstComparison.status,201);trackRecord(firstComparison.data);
 const cDefaults=(await request('/settings',c.cookie)).data;
 assert.equal(cDefaults.hasPersonalDefaults,true);assert.deepEqual(cDefaults.fields,c.data.fields,'first use preserves the initial defaults without adopting comparison settings');
 const catalog=await request('/products/'+first.data.productId+'/measurement',a.cookie,'PUT',{specCode:'defaults-A-'+fixture,snapshot:{fields:{...fields,tax:'19'}},defaultFields:{tax:'19'}});
 assert.equal(catalog.status,200);assert.equal(catalog.data.defaults.fields.tax,'19');assert.equal((await request('/settings',b.cookie)).data.fields.tax,b.data.fields.tax);
 const restored=await request('/records/'+first.data.id+'/restore',a.cookie,'POST',{});
 assert.equal(restored.status,200);assert.equal(restored.data.snapshot.fields.promotion,'23');assert.equal((await request('/settings',a.cookie)).data.fields.tax,'19');
 const beforeFailure=(await request('/settings',a.cookie)).data;
 const failed=await request('/records/'+first.data.id,a.cookie,'PATCH',{specCode:'defaults-B-'+fixture,snapshot:{fields},defaultFields:{promotion:'99'}});
 assert.equal(failed.status,409);assert.deepEqual((await request('/settings',a.cookie)).data,beforeFailure);
 assert.equal((await request('/settings',a.cookie,'PUT',{fields:{promotion:''}})).status,400);
 assert.equal((await request('/settings',a.cookie,'PUT',{fields:{promotion:'1'},userId:'other-user'})).status,400);
 assert.deepEqual((await pool.query('SELECT fields,updated_at FROM profit.global_settings WHERE id=1')).rows,template);
 console.log('Personal defaults smoke passed: isolated users, reload, comparison snapshots, shared history, catalog-only edits, restore, partial saves, failed-save rollback.');
}finally{
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('DELETE FROM profit.records WHERE id=ANY($1::uuid[])',[recordIds]);
  await client.query('DELETE FROM profit.products WHERE id=ANY($1::uuid[])',[productIds]);
  await client.query('DELETE FROM profit.calculation_defaults WHERE owner_key=ANY($1::text[])',[scopes]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error}
 finally{client.release();server.kill('SIGTERM');await pool.end()}
 console.log('All fixtures removed.');
}
