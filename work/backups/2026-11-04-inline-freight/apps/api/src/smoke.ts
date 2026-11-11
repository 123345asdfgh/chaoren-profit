import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {pool} from './db.js';

const port=3319,base='http://127.0.0.1:'+port+'/api/profit',origin='http://127.0.0.1:8081',name='演示商品-'+randomBytes(5).toString('hex');
const server=spawn(process.execPath,['--import','tsx','src/server.ts'],{cwd:process.cwd(),env:{...process.env,API_PORT:String(port),LOG_LEVEL:'silent'},stdio:'ignore'});
async function call(path:string,method='GET',body?:unknown){const response=await fetch(base+path,{method,headers:{origin,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()}}
function ensure(test:boolean,label:string){if(!test)throw Error(label)}
const fields={length:'20',width:'15',height:'10',weight:'0.2',attribute:'潮玩',store:'广州店铺',packType:'parcel',referenceChina:'100',chinaPrice:'100',salePrice:'41.18',buyerShipping:'0',receipt:'41.18',logistics:'50.1',currency:'RMB',fx:'6.8',multiplier:'2.8',costRate:'40',divisor:'1.13',tax:'25',promotion:'20',operation:'10',platform:'7',royalty:'4',labor:'3',other:'2',zone:'America/Los_Angeles'};
const body={market:'US',name,specCode:'0001',productCode:'0002',snapshot:{fields}};
let id='',legacyId='',duplicateId='';
try{
 let ready=false;for(let i=0;i<30;i++){try{ready=(await call('/health')).status===200;if(ready)break}catch{}await delay(100)}ensure(ready,'server not ready');
 const first=await call('/records','POST',{...body,snapshot:{fields,quote:{result:{cny:50.1}},adoptedQuote:{cny:50.1}}});ensure(first.status===201&&first.data.version===1&&first.data.category==='潮玩','initial save failed');id=first.data.id;
 ensure(!('length' in first.data.snapshot.fields)&&!('packType' in first.data.snapshot.fields)&&!('store' in first.data.snapshot.fields)&&!('quote' in first.data.snapshot)&&!('adoptedQuote' in first.data.snapshot),'package calculator data was stored');
 const stored=await pool.query('SELECT order_number,product_spec,category FROM profit.records WHERE id=$1',[id]);ensure(stored.rows[0].order_number===null&&stored.rows[0].product_spec===null&&stored.rows[0].category==='潮玩','removed fields must not be stored');
 const second=await call('/records/'+id,'PATCH',{...body,snapshot:{fields:{...fields,salePrice:'50',receipt:'50'}}});ensure(second.data.id===id&&second.data.version===2&&second.data.previousVersion===1&&second.data.previousSnapshot,'version save failed: '+JSON.stringify(second));
 const third=await call('/records/'+id,'PATCH',{...body,snapshot:{fields:{...fields,salePrice:'60',receipt:'60'}}});ensure(third.data.id===id&&third.data.version===3&&third.data.previousVersion===2,'third version failed');
 const found=await call('/records?q='+encodeURIComponent(name)+'&specCode=0001&productCode=0002&limit=10');ensure(found.data.total===1&&found.data.records[0].id===id,'specific search failed');
 const missing=await call('/records?productCode=other&limit=20');ensure(missing.data.total===0,'specific filter failed');
 const all=await call('/records?limit=50');ensure(all.data.records.some((record:{id:string})=>record.id===id),'unfiltered list failed');
 const legacyName=name+'-旧版';
 const legacyFields={...fields,attribute:'毛绒'};
 const legacy=await pool.query('INSERT INTO profit.records(market,order_number,name,product_spec,category,spec_code,product_code,snapshot,net_rmb,net_usd,margin) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11) RETURNING id',['US','旧订单',legacyName,'旧规格','毛绒','0001','0002',JSON.stringify({fields:legacyFields}),first.data.netRmb,first.data.netUsd,first.data.margin]);
 legacyId=legacy.rows[0].id;
 const legacySave=await call('/records/'+legacyId,'PATCH',{...body,name:legacyName,snapshot:{fields:legacyFields}});ensure(legacySave.data.id===legacyId&&legacySave.data.version===2&&legacySave.data.category==='毛绒'&&legacySave.data.previousSnapshot,'legacy record version failed');
 const legacyStored=await pool.query('SELECT order_number,product_spec FROM profit.records WHERE id=$1',[legacyId]);ensure(legacyStored.rows[0].order_number==='旧订单'&&legacyStored.rows[0].product_spec==='旧规格','legacy fields changed');
 const onlyOne=await call('/records?category=毛绒&q='+encodeURIComponent(name));ensure(onlyOne.data.total===1&&onlyOne.data.records[0].id===legacyId,'single-category search failed');
 const categoryMatch=await call('/records?category=潮玩&category=毛绒&q='+encodeURIComponent(name));ensure(categoryMatch.data.total===2,'multi-category search failed');
 const csv=await fetch(base+'/records/export?q='+encodeURIComponent(name)+'&category=毛绒');const csvText=await csv.text();ensure(csv.status===200&&csvText.includes('商品名称')&&csvText.includes(legacyName)&&!csvText.includes('"'+name+'"')&&!csvText.includes('长（cm）')&&!csvText.includes('尺寸类型')&&csvText.split('\r\n').length===2,'filtered CSV export failed');
 const restored=await call('/records/'+id+'/restore','POST');ensure(restored.data.version===2&&restored.data.previousVersion===3&&Math.abs(restored.data.netRmb-second.data.netRmb)<.001,'restore failed');
 const switched=await call('/records/'+id+'/restore','POST');ensure(switched.data.version===3&&switched.data.previousVersion===2,'version switch failed');
 const detail=await call('/records/'+id);ensure(detail.data.id===id,'shared detail failed');
 const duplicate=await call('/records','POST',body);duplicateId=duplicate.data.id;
 ensure(duplicate.status===201&&duplicateId!==id&&duplicate.data.version===1,'new order with same identity must create a separate record');
 const both=await call('/records?q='+encodeURIComponent(name)+'&specCode=0001&productCode=0002&limit=10');
 ensure(both.data.total===3&&both.data.records.some((row:{id:string})=>row.id===duplicateId),'new order missing from shared history');
 const missingEdit=await call('/records/00000000-0000-4000-8000-000000000000','PATCH',body);ensure(missingEdit.status===404,'missing loaded record must not create a new order');
 console.log('PASS create versus edit, multi-category search, CSV export, legacy compatibility, version restore, detail');
}finally{server.kill('SIGTERM');if(id)await pool.query('DELETE FROM profit.records WHERE id=$1',[id]);if(legacyId)await pool.query('DELETE FROM profit.records WHERE id=$1',[legacyId]);if(duplicateId)await pool.query('DELETE FROM profit.records WHERE id=$1',[duplicateId]);await pool.end()}
