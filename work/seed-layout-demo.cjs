// Explicitly labeled demo records, saved through the existing business API.
const fs=require('node:fs');
const DailyCore=require('../apps/web/public/legacy/core.js');
const FreightCore=require('../apps/web/public/legacy/freight-core.js');
const base='http://127.0.0.1:8081/api/profit';
const fixtures=[
 {name:'【演示】星际旅行盲盒',specCode:'DEMO-20261107-BLIND-01',productCode:'DEMO-P-BLIND-01',attribute:'盲盒',length:14,width:12,height:10,weight:.32,chinaPrice:59,orders:[{salePrice:29.99,buyerShipping:4.99,logistics:54},{salePrice:31.99,buyerShipping:4.99,logistics:51}]},
 {name:'【演示】奶油猫毛绒公仔',specCode:'DEMO-20261107-PLUSH-01',productCode:'DEMO-P-PLUSH-01',attribute:'毛绒',length:32,width:24,height:20,weight:.65,chinaPrice:89,orders:[{salePrice:34.99,buyerShipping:5.99,logistics:128},{salePrice:39.99,buyerShipping:5.99,logistics:112}]},
 {name:'【演示】旅行随行杯',specCode:'DEMO-20261107-CUP-01',productCode:'DEMO-P-CUP-01',attribute:'常规',length:22,width:10,height:10,weight:.28,chinaPrice:39,orders:[{salePrice:19.99,buyerShipping:4.99,logistics:45},{salePrice:21.99,buyerShipping:4.99,logistics:42}]}
];
let cookie='';
async function request(path,method='GET',body){
 const response=await fetch(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
 const result=await response.json();if(!response.ok)throw Error(`${method} ${path}: ${JSON.stringify(result)}`);return result;
}
(async()=>{
 const saved=[];
 for(const item of fixtures){
  const found=await request('/products?specCode='+encodeURIComponent(item.specCode));
  if(found.products.some(p=>p.specCode===item.specCode)){console.log('Already exists:',item.specCode);continue;}
  let productId=null;
  for(const [index,order] of item.orders.entries()){
   const fields=Object.fromEntries(Object.entries({...DailyCore.DEFAULTS,...order,chinaPrice:item.chinaPrice,receipt:Number((order.salePrice+order.buyerShipping).toFixed(2)),currency:'RMB',zone:'America/Los_Angeles',attribute:item.attribute,length:item.length,width:item.width,height:item.height,weight:item.weight,packType:'parcel',store:'广州店铺',photoId:''}).map(([key,value])=>[key,String(value)]));
   const body={name:item.name,specCode:item.specCode,productCode:item.productCode,productId,market:'US',snapshot:{fields,freight:FreightCore.cloneConfig(FreightCore.DEFAULT_CONFIG)}};
   let record=await request('/records','POST',body);productId=record.productId;
   if(index===0){
    fields.logistics=String(order.logistics-3);
    record=await request('/records/'+record.id,'PATCH',{...body,productId,snapshot:{...body.snapshot,fields}});
   }
   saved.push({name:item.name,specCode:item.specCode,id:record.id,productId,version:record.version,netRmb:record.netRmb,margin:record.margin});
  }
 }
 fs.writeFileSync('work/layout-demo-records.json',JSON.stringify(saved,null,2));
 console.log(JSON.stringify(saved.map(r=>({name:r.name,version:r.version,profit:r.netRmb,margin:(r.margin*100).toFixed(2)+'%'})),null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
