import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {pool} from './db.js';

const port=3320,base=`http://127.0.0.1:${port}/api/profit`,label='商品资料验收-'+randomBytes(6).toString('hex');
const server=spawn(process.execPath,['--import','tsx','src/server.ts'],{cwd:process.cwd(),env:{...process.env,API_PORT:String(port),LOG_LEVEL:'silent'},stdio:'ignore'});
async function call(path:string,method='GET',body?:unknown){const response=await fetch(base+path,{method,headers:{origin:'http://127.0.0.1:8081',...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()}}
function ensure(test:boolean,message:string){if(!test)throw Error(message)}
const body={name:label+' Blue Box',specCode:'00012-A',productCode:'000034-'+label+'-base',attribute:'普货',length:20,width:15,height:10,weight:.2};
const updatedCode='0000099-'+label;
try{
 let ready=false;for(let attempt=0;attempt<30;attempt++){try{ready=(await call('/health')).status===200;if(ready)break}catch{}await delay(100)}ensure(ready,'API not ready');
 const first=await call('/products','POST',body);ensure(first.status===201&&first.data.name===body.name&&first.data.weight===.2&&first.data.specCode==='00012-A'&&first.data.productCode===body.productCode,'product creation must preserve text codes and leading zeros');
 const duplicate=await call('/products','POST',{...body,name:'  '+label+'   BLUE   BOX  ',productCode:label+'-new-name-code',length:999});ensure(duplicate.status===409,'normalized product names must be unique');
 const concurrent=await Promise.all([call('/products','POST',{...body,name:label+' 并发商品',productCode:'000034-'+label+'-concurrent-a'}),call('/products','POST',{...body,name:label+' 并发商品',productCode:'000034-'+label+'-concurrent-b'})]);ensure(concurrent.filter(result=>result.status===201).length===1&&concurrent.filter(result=>result.status===409).length===1,'database must prevent concurrent duplicate names');
 const concurrentProduct=concurrent.find(result=>result.status===201)!.data;
 for(let index=0;index<10;index++){const result=await call('/products','POST',{...body,name:label+' 商品'+index,attribute:index%2?'潮玩':'带电',specCode:index<5?body.specCode:'00055-C',productCode:(index<5?'000034-':'000067-')+label+'-'+index});ensure(result.status===201,'pagination fixture failed')}
 const page=await call('/products?q='+encodeURIComponent(label)+'&limit=10');ensure(page.status===200&&page.data.total===12&&page.data.products.length===10,'shared product pagination failed');
 const last=await call('/products?q='+encodeURIComponent(label)+'&limit=10&page=2');ensure(last.data.products.length===2,'product second page failed');
 const filtered=await call('/products?q='+encodeURIComponent(label)+'&attribute=带电&limit=20');ensure(filtered.data.total===5&&filtered.data.products.every((item:{attribute:string})=>item.attribute==='带电'),'product attribute filter failed');
 const search=(filters:Record<string,string>)=>call('/products?'+new URLSearchParams({q:label,...filters}));
 const specFiltered=await search({specCode:'  00012-a  '});ensure(specFiltered.status===200&&specFiltered.data.total===7,'specification search must preserve leading zeros, trim whitespace and ignore case');
 const productFiltered=await search({productCode:'000067'});ensure(productFiltered.status===200&&productFiltered.data.total===5,'product code search must filter independently');
 const combined=await search({specCode:'12-a',productCode:'0034',attribute:'带电'});ensure(combined.status===200&&combined.data.total===3&&combined.data.products.every((item:{attribute:string,specCode:string,productCode:string})=>item.attribute==='带电'&&item.specCode===body.specCode&&item.productCode.startsWith('000034-')),'all four filters must intersect using code substring matching');
 const mismatch=await search({specCode:'00012-A',productCode:'000067'});ensure(mismatch.data.total===0&&mismatch.data.products.length===0,'incompatible code filters must return no products');
 const filteredPage=await search({specCode:'00012-A',page:'2'});ensure(filteredPage.data.total===7&&filteredPage.data.products.length===0,'filtered count and pagination must use the same conditions');
 const exact=await call('/products/suggestions?q='+encodeURIComponent(label+' blue box'));ensure(exact.status===200&&exact.data.products[0].id===first.data.id&&exact.data.products[0].length===20,'product name lookup must preserve existing measurements');
 ensure(exact.data.products[0].specCode===body.specCode&&exact.data.products[0].productCode===body.productCode&&exact.data.products[0].attribute===body.attribute,'name lookup must include product identity');
 ensure(!('store' in exact.data.products[0])&&!('packType' in exact.data.products[0]),'product lookup must not supply session shipping selections');
 const prohibited=await call('/products','POST',{...body,name:label+' 不允许字段',store:'香港店铺',packType:'naked'});ensure(prohibited.status===400,'product data must reject store and parcel type');
 const invalid=await call('/products','POST',{...body,name:label+' 非法尺寸',weight:0});ensure(invalid.status===400,'invalid product measurements accepted');
 const sameCode=await call('/products/'+first.data.id,'PATCH',{...body,length:21});ensure(sameCode.status===200,'a product must be allowed to keep its own code while editing');
 const duplicateCode=await call('/products','POST',{...body,name:label+' 重复编码',productCode:'  '+body.productCode.toUpperCase()+'  '});ensure(duplicateCode.status===409&&duplicateCode.data.error.includes('商品编码已存在'),'new products must reject duplicate codes ignoring case and surrounding whitespace');
 const duplicateEdit=await call('/products/'+first.data.id,'PATCH',{...body,productCode:concurrentProduct.productCode});ensure(duplicateEdit.status===409&&duplicateEdit.data.error.includes('商品编码已存在'),'editing must reject another product code');
 const unchanged=await call('/products/suggestions?q='+encodeURIComponent(body.name));ensure(unchanged.data.products[0].productCode===body.productCode&&unchanged.data.products[0].length===21,'rejected edits must preserve the original product');
 const edited=await call('/products/'+first.data.id,'PATCH',{...body,attribute:'带磁',specCode:'00007-B',productCode:updatedCode,length:22,weight:.000001});ensure(edited.status===200&&edited.data.id===first.data.id&&edited.data.length===22&&edited.data.weight===.000001,'editing a product must update the existing row');
 const forbiddenRename=await call('/products/'+first.data.id,'PATCH',{...body,name:label+' 商品1'});ensure(forbiddenRename.status===409,'renaming must not duplicate another product');
 const updated=await call('/products/suggestions?q='+encodeURIComponent(body.name));ensure(updated.data.products[0].length===22&&updated.data.products[0].attribute==='带磁'&&updated.data.products[0].specCode==='00007-B'&&updated.data.products[0].productCode===updatedCode,'updated product lookup is stale');
 const literal=await call('/products','POST',{...body,name:label+' 50%_限定',specCode:label+'-S%_01',productCode:label+'-P%_02'});ensure(literal.status===201,'literal search fixture failed');
 const literalSearch=await call('/products?q='+encodeURIComponent(label+' 50%_'));ensure(literalSearch.data.total===1&&literalSearch.data.products[0].id===literal.data.id,'search must treat percent and underscore literally');
 for(const key of ['specCode','productCode']){
  const codeOnly=await call('/products?'+new URLSearchParams({[key]:literal.data[key].toUpperCase()}));ensure(codeOnly.status===200&&codeOnly.data.total===1&&codeOnly.data.products[0].id===literal.data.id,'each code must support standalone case-insensitive literal search');
  const symbols=await search({[key]:'%_'});ensure(symbols.data.total===1&&symbols.data.products[0].id===literal.data.id,'code search must treat percent and underscore literally');
 }
 const overlong=await search({specCode:'x'.repeat(201)});ensure(overlong.status===400,'overlong code filters must be rejected');
 const numericCode=await call('/products','POST',{...body,name:label+' 数字编码',productCode:34});ensure(numericCode.status===400,'codes must be strings to preserve leading zeros');
 const emptyCode=await call('/products','POST',{...body,name:label+' 空白编码',specCode:'  '});ensure(emptyCode.status===400,'product entry must require a specification code');
 const columns=await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='profit' AND table_name='products'");ensure(!columns.rows.some(row=>['store','pack_type','packType'].includes(row.column_name)),'product table contains session shipping selections');
 const removed=await call('/products/'+literal.data.id,'DELETE');ensure(removed.status===200&&removed.data.deleted&&removed.data.id===literal.data.id,'product deletion failed');
 const removedLookup=await call('/products/suggestions?q='+encodeURIComponent(literal.data.name));ensure(removedLookup.data.products.length===0,'deleted product remains in name lookup');
 const removedList=await call('/products?q='+encodeURIComponent(literal.data.name));ensure(removedList.data.total===0,'deleted product remains in the table');
 const missingDelete=await call('/products/'+literal.data.id,'DELETE');ensure(missingDelete.status===404,'missing product deletion should return 404');
 const recreate=await call('/products','POST',{...body,name:literal.data.name});ensure(recreate.status===201&&recreate.data.id!==literal.data.id,'deleted product name should allow a fresh entry');
 const codeRace=await Promise.all(['A','B'].map(suffix=>call('/products','POST',{...body,name:label+' 编码并发'+suffix,productCode:'000-race-'+label})));ensure(codeRace.filter(result=>result.status===201).length===1&&codeRace.filter(result=>result.status===409&&result.data.error.includes('商品编码已存在')).length===1,'concurrent different products must not share a code');
 try{await pool.query('INSERT INTO profit.products(name,spec_code,product_code,attribute,length,width,height,weight) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[label+' 数据库重复',body.specCode,updatedCode.toUpperCase(),body.attribute,20,15,10,.2]);throw Error('database accepted a duplicate code')}catch(error){ensure((error as {code?:string;constraint?:string}).code==='23505'&&(error as {constraint?:string}).constraint==='products_product_code_unique','database unique index must reject direct duplicate writes')}
 console.log('PASS product persistence, name/code uniqueness, concurrent writes, self-editing, rejected-update preservation, database constraint, combined search, pagination, editing, deletion and lookup');
}finally{
 server.kill('SIGTERM');
 await pool.query('DELETE FROM profit.products WHERE starts_with(name,$1)',[label]);
 await pool.end();
}
