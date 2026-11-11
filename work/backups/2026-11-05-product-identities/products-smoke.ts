import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {pool} from './db.js';

const port=3320,base=`http://127.0.0.1:${port}/api/profit`,label='商品资料验收-'+randomBytes(6).toString('hex');
const server=spawn(process.execPath,['--import','tsx','src/server.ts'],{cwd:process.cwd(),env:{...process.env,API_PORT:String(port),LOG_LEVEL:'silent'},stdio:'ignore'});
async function call(path:string,method='GET',body?:unknown){const response=await fetch(base+path,{method,headers:{origin:'http://127.0.0.1:8081',...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()}}
function ensure(test:boolean,message:string){if(!test)throw Error(message)}
const body={name:label+' Blue Box',attribute:'普货',length:20,width:15,height:10,weight:.2};
try{
 let ready=false;for(let attempt=0;attempt<30;attempt++){try{ready=(await call('/health')).status===200;if(ready)break}catch{}await delay(100)}ensure(ready,'API not ready');
 const first=await call('/products','POST',body);ensure(first.status===201&&first.data.name===body.name&&first.data.weight===.2,'product creation failed');
 const duplicate=await call('/products','POST',{...body,name:'  '+label+'   BLUE   BOX  ',length:999});ensure(duplicate.status===409,'normalized product names must be unique');
 const concurrent=await Promise.all([call('/products','POST',{...body,name:label+' 并发商品'}),call('/products','POST',{...body,name:label+' 并发商品'})]);ensure(concurrent.filter(result=>result.status===201).length===1&&concurrent.filter(result=>result.status===409).length===1,'database must prevent concurrent duplicate inserts');
 for(let index=0;index<10;index++){const result=await call('/products','POST',{...body,name:label+' 商品'+index,attribute:index%2?'潮玩':'带电'});ensure(result.status===201,'pagination fixture failed')}
 const page=await call('/products?q='+encodeURIComponent(label)+'&limit=10');ensure(page.status===200&&page.data.total===12&&page.data.products.length===10,'shared product pagination failed');
 const last=await call('/products?q='+encodeURIComponent(label)+'&limit=10&page=2');ensure(last.data.products.length===2,'product second page failed');
 const filtered=await call('/products?q='+encodeURIComponent(label)+'&attribute=带电&limit=20');ensure(filtered.data.total===5&&filtered.data.products.every((item:{attribute:string})=>item.attribute==='带电'),'product attribute filter failed');
 const exact=await call('/products/suggestions?q='+encodeURIComponent(label+' blue box'));ensure(exact.status===200&&exact.data.products[0].id===first.data.id&&exact.data.products[0].length===20,'product name lookup must preserve existing measurements');
 ensure(!('store' in exact.data.products[0])&&!('packType' in exact.data.products[0]),'product lookup must not supply session shipping selections');
 const prohibited=await call('/products','POST',{...body,name:label+' 不允许字段',store:'香港店铺',packType:'naked'});ensure(prohibited.status===400,'product data must reject store and parcel type');
 const invalid=await call('/products','POST',{...body,name:label+' 非法尺寸',weight:0});ensure(invalid.status===400,'invalid product measurements accepted');
 const edited=await call('/products/'+first.data.id,'PATCH',{...body,attribute:'带磁',length:22,weight:.000001});ensure(edited.status===200&&edited.data.id===first.data.id&&edited.data.length===22&&edited.data.weight===.000001,'editing a product must update the existing row');
 const forbiddenRename=await call('/products/'+first.data.id,'PATCH',{...body,name:label+' 商品1'});ensure(forbiddenRename.status===409,'renaming must not duplicate another product');
 const updated=await call('/products/suggestions?q='+encodeURIComponent(body.name));ensure(updated.data.products[0].length===22&&updated.data.products[0].attribute==='带磁','updated product lookup is stale');
 const literal=await call('/products','POST',{...body,name:label+' 50%_限定'});ensure(literal.status===201,'literal search fixture failed');
 const literalSearch=await call('/products?q='+encodeURIComponent(label+' 50%_'));ensure(literalSearch.data.total===1&&literalSearch.data.products[0].id===literal.data.id,'search must treat percent and underscore literally');
 const columns=await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='profit' AND table_name='products'");ensure(!columns.rows.some(row=>['store','pack_type','packType'].includes(row.column_name)),'product table contains session shipping selections');
 const removed=await call('/products/'+literal.data.id,'DELETE');ensure(removed.status===200&&removed.data.deleted&&removed.data.id===literal.data.id,'product deletion failed');
 const removedLookup=await call('/products/suggestions?q='+encodeURIComponent(literal.data.name));ensure(removedLookup.data.products.length===0,'deleted product remains in name lookup');
 const removedList=await call('/products?q='+encodeURIComponent(literal.data.name));ensure(removedList.data.total===0,'deleted product remains in the table');
 const missingDelete=await call('/products/'+literal.data.id,'DELETE');ensure(missingDelete.status===404,'missing product deletion should return 404');
 const recreate=await call('/products','POST',{...body,name:literal.data.name});ensure(recreate.status===201&&recreate.data.id!==literal.data.id,'deleted product name should allow a fresh entry');
 console.log('PASS product persistence, normalized/concurrent uniqueness, shared search/pagination, editing, deletion, exact lookup and shipping-selection separation');
}finally{
 server.kill('SIGTERM');
 await pool.query('DELETE FROM profit.products WHERE starts_with(name,$1)',[label]);
 await pool.end();
}
