const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const FreightCore=require('./freight-core.js');
const DailyCore=require('./core.js');
const TimeCore=require('./time-core.js');

function calculator(options={}){
 const elements=new Map(),timers=new Map();let timerId=0;
 function get(id){
  if(!elements.has(id)){
   const classes=new Set(),events={};
   elements.set(id,{id,value:'',textContent:'',validity:{valid:true},dataset:{},children:[],
    classList:{add:(...values)=>values.forEach(value=>classes.add(value)),remove:(...values)=>values.forEach(value=>classes.delete(value)),contains:value=>classes.has(value),toggle:(value,on)=>{if(on??!classes.has(value))classes.add(value);else classes.delete(value)}},
    addEventListener:(name,handler)=>(events[name]??=[]).push(handler),
    dispatch:async name=>{for(const handler of events[name]||[])await handler({})},
    replaceChildren(){},setAttribute(){},removeAttribute(){},checkValidity(){return true},closest(){return this},focus(){},cloneNode(){return {...this}}
   });
  }
  return elements.get(id);
 }
 for(const [id,value]of Object.entries({...DailyCore.DEFAULTS,zone:'America/Los_Angeles',currency:'RMB',packType:'parcel',store:'广州店铺',buyerShipping:0}))get(id).value=String(value);
 const context=vm.createContext({document:{getElementById:get,querySelector:()=>null,querySelectorAll:()=>[]},DailyCore,FreightCore,TimeCore,
  savedFreightSettings:FreightCore.cloneConfig(FreightCore.DEFAULT_CONFIG),window:{},Option:function(){},URLSearchParams,URL,location:{href:'http://127.0.0.1:8081/calculator',search:''},history:{replaceState(){}},
  fetch:options.fetch||(async()=>({ok:true,json:async()=>({fields:options.defaults||{}})})),
  setInterval(){},setTimeout:handler=>{timers.set(++timerId,handler);return timerId},clearTimeout:id=>timers.delete(id),
  apiRequest:async()=>({products:[]})});
 const run=source=>vm.runInContext(source,context);
 const load=file=>run(fs.readFileSync(__dirname+'/'+file,'utf8'));
 load('app.js');
 function parcel(values={}){for(const [id,value]of Object.entries({length:20,width:15,height:10,weight:.2,attribute:'普货',...values}))get(id).value=String(value);}
 return {get,run,load,parcel,async lookup(){const pending=[...timers.values()];timers.clear();for(const callback of pending)await callback();await new Promise(resolve=>setImmediate(resolve));}};
}

test('freight is an estimate until adopted, and editing the quote never overwrites the entered cost',async()=>{
 const app=calculator();app.parcel();app.run('updateFreightQuote()');
 assert.equal(app.get('logistics').value,'');assert.equal(app.get('freight-estimate-value').textContent,'50.10 RMB');
 await app.get('adopt-freight').dispatch('click');assert.equal(app.get('logistics').value,'50.1');
 app.get('logistics').value='77';app.parcel({weight:.5});app.run('updateFreightQuote()');
 assert.equal(app.get('logistics').value,'77');assert.equal(app.get('adopt-freight').disabled,false);
});

test('normal saves keep personal defaults; non-exchange settings need the explicit default button',async()=>{
 let defaults={...Object.fromEntries(Object.entries(DailyCore.DEFAULTS).map(([key,value])=>[key,String(value)])),promotion:'21',zone:'America/Los_Angeles'};
 const requests=[];
 const app=calculator({fetch:async(url,options)=>{
  if(!options)return {ok:true,json:async()=>({fields:{...defaults}})};
  const body=JSON.parse(options.body);requests.push(body);
  if(url.endsWith('/settings')){defaults={...defaults,...body.fields};return {ok:true,json:async()=>({fields:{...defaults}})}}
  if(body.defaultFields)defaults={...defaults,...body.defaultFields};
  return {ok:true,json:async()=>({id:'test-record',defaults:body.defaultFields?{fields:{...defaults}}:undefined})};
 }});
 app.load('settings.js');await app.run('defaultsReady');app.load('archive-db.js');
 assert.equal(app.get('promotion').value,'21');
 app.get('archive-spec').value='SPEC-ONLY';app.get('promotion').value='22';await app.get('promotion').dispatch('input');
 await app.run('saveProfit()');assert.equal(requests[0].defaultFields,undefined);assert.equal(defaults.promotion,'21');
 await app.run('saveMyDefaults()');assert.equal(requests[1].promotion,undefined);assert.equal(requests[1].fields.promotion,'22');assert.equal(defaults.promotion,'22');
 app.run("applyMeasurementFields({promotion:'39'})");
 await app.run('saveProfit()');assert.equal(requests[2].defaultFields,undefined);assert.equal(defaults.promotion,'22');
 await app.run("saveProfit({promotion:'55'},undefined,{updateDefaults:false})");
 assert.equal(requests[3].defaultFields,undefined);assert.equal(requests[3].snapshot.fields.promotion,'55');
 app.run("applyMeasurementFields({promotion:'55'});beginNewMeasurement(false)");
 assert.equal(app.get('promotion').value,'22');assert.equal(app.get('archive-spec').value,'');
});

test('manual exchange-rate edits update personal defaults while loaded values do not',async()=>{
 let defaults={...Object.fromEntries(Object.entries(DailyCore.DEFAULTS).map(([key,value])=>[key,String(value)])),zone:'America/Los_Angeles'};
 const settingsWrites=[];
 const app=calculator({fetch:async(url,options)=>{
  if(!options)return {ok:true,json:async()=>({fields:{...defaults}})};
  const body=JSON.parse(options.body);
  if(url.endsWith('/settings')){settingsWrites.push(body.fields);defaults={...defaults,...body.fields};return {ok:true,json:async()=>({fields:{...defaults}})}}
  return {ok:true,json:async()=>({id:'test-record'})};
 }});
 app.load('settings.js');await app.run('defaultsReady');app.load('archive-db.js');
 app.get('fx').value='7.2';await app.get('fx').dispatch('input');app.run("applyMeasurementFields({fx:'8.1'})");await app.lookup();
 assert.equal(defaults.fx,'7.2');assert.equal(settingsWrites.length,1);assert.deepEqual(settingsWrites[0],{fx:'7.2'});
});

test('bodyless catalog deletes omit JSON content type while saves keep it',async()=>{
 const requests=[];
 const app=calculator({fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({deleted:true})}}});
 app.load('archive-db.js');
 await app.run("apiRequest('/products/test-product',{method:'DELETE'})");
 await app.run("apiRequest('/products?limit=10')");
 await app.run("apiRequest('/records',{method:'POST',body:JSON.stringify({specCode:'TEST'})})");
 assert.equal(requests[0].options.method,'DELETE');
 assert.equal(requests[0].options.headers['content-type'],undefined);
 assert.equal(requests[0].options.body,undefined);
 assert.equal(requests[1].options.headers['content-type'],undefined);
 assert.equal(requests[2].options.headers['content-type'],'application/json');
 assert.equal(JSON.parse(requests[2].options.body).specCode,'TEST');
});

test('empty optional configuration values do not erase personal defaults',async()=>{
 const app=calculator({defaults:{promotion:'21'}});app.load('settings.js');await app.run('defaultsReady');
 app.get('promotion').value='';await app.get('promotion').dispatch('input');
 assert.equal(JSON.stringify(app.run('defaultFieldsForSave()')),'{}');
 assert.equal(app.run('savedBusinessSettings.promotion'),'21');
});

test('delayed defaults still populate untouched settings without overwriting typed values',async()=>{
 let complete;
 const app=calculator({fetch:()=>new Promise(resolve=>{complete=resolve})});
 app.load('settings.js');app.get('chinaPrice').value='100';await app.get('chinaPrice').dispatch('input');
 app.get('promotion').value='22';await app.get('promotion').dispatch('input');
 complete({ok:true,json:async()=>({fields:{operation:'18',promotion:'30',fx:'7.2'}})});await app.run('defaultsReady');
 assert.equal(app.get('chinaPrice').value,'100');assert.equal(app.get('operation').value,'18');assert.equal(app.get('fx').value,'7.2');assert.equal(app.get('promotion').value,'22');
 assert.equal(app.run('savedBusinessSettings.promotion'),'30');
});

test('an invalid estimate has a red hint and cannot replace a manually confirmed cost',async()=>{
 for(const invalid of [{weight:10.01},{length:100,width:100,height:100},{weight:0}]){
  const app=calculator();app.parcel(invalid);app.get('logistics').value='168';app.run('updateFreightQuote()');
  assert.equal(app.get('logistics').value,'168');assert.equal(app.get('adopt-freight').disabled,true);
  assert.equal(app.get('freight-estimate-message').classList.contains('input-error'),true);
  await app.get('adopt-freight').dispatch('click');assert.equal(app.get('logistics').value,'168');
 }
});

test('a search with no result preserves the editable form for a new product',async()=>{
 const app=calculator();app.load('product-catalog.js');app.parcel();app.get('archive-name').value='新商品';app.get('logistics').value='70';
 app.get('product-search').value='未保存的规格';await app.get('product-search').dispatch('input');await app.lookup();
 assert.equal(app.get('archive-name').value,'新商品');assert.equal(app.get('logistics').value,'70');
 assert.match(app.get('product-name-hint').textContent,/直接在下方填写新商品/);
});

test('comparison estimates also require adoption and preserve the saved manual cost',async()=>{
 const app=calculator();app.load('compare-ui.js');
 for(const [id,value]of Object.entries({length:20,width:15,height:10,weight:.2,store:'广州店铺',packType:'parcel',currency:'RMB',fx:6.8,logistics:168}))app.get('compare-'+id).value=String(value);
 app.get('attribute').value='普货';app.run('compareFreightSettings=savedFreightSettings;updateCompareFreightQuote()');
 assert.equal(app.get('compare-logistics').value,'168');assert.equal(app.get('compare-adopt-freight').disabled,false);
 await app.get('compare-adopt-freight').dispatch('click');assert.equal(app.get('compare-logistics').value,'50.1');
 app.get('compare-weight').value='20';app.run('updateCompareFreightQuote()');assert.equal(app.get('compare-logistics').value,'50.1');assert.equal(app.get('compare-adopt-freight').disabled,true);
});

test('clearing a configuration field keeps all profit rows and restores them when completed',async()=>{
 const app=calculator();
 for(const [id,value]of Object.entries({chinaPrice:100,salePrice:40,buyerShipping:5,receipt:45,logistics:70}))app.get(id).value=String(value);
 app.run('autoSale=false;renderProfit()');
 const complete=app.get('breakdown').innerHTML;
 assert.equal((complete.match(/<tr /g)||[]).length,13);
 app.get('promotion').value='';await app.get('promotion').dispatch('input');
 const partial=app.get('breakdown').innerHTML;
 assert.equal((partial.match(/<tr /g)||[]).length,13);
 assert.match(partial,/<td>－ 推广费<\/td><td>—<\/td><td>—<\/td>/);
 assert.match(partial,/<td>－ 产品成本<\/td><td>5\.88 💲<\/td><td>40\.00 RMB<\/td>/);
 assert.match(partial,/<td>净利润<\/td><td>—<\/td><td>—<\/td>/);
 assert.equal(app.run('latest'),null);
 app.get('promotion').value='25';await app.get('promotion').dispatch('input');
 assert.equal(app.get('breakdown').innerHTML,complete);assert.ok(app.run('latest')!==null);
});

test('photos follow product and history snapshots and are cleared for a new order',async()=>{
 const requests=[],app=calculator({fetch:async(url,options)=>{if(!options)return {ok:true,json:async()=>({fields:{}})};requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({id:'record'})}}});
 app.load('settings.js');await app.run('defaultsReady');app.load('product-photo.js');app.load('archive-db.js');
 const photo='81e7cc54-0468-4ff2-b3b3-7aebcd2e9f3c';
 app.get('archive-spec').value='PHOTO-SPEC';app.get('photoId').value=photo;await app.run('saveProfit()');
 assert.equal(requests[0].snapshot.fields.photoId,photo);
 app.run("applyMeasurementFields({promotion:'20'})");assert.equal(app.get('photoId').value,photo);
 app.run('beginNewMeasurement(false)');assert.equal(app.get('photoId').value,'');assert.equal(app.get('product-photo-preview').hidden,true);
 app.run(`loadProductMeasurement({id:'product',name:'',specCode:'PHOTO-SPEC',productCode:'',attribute:'',snapshot:{fields:{photoId:'${photo}'}}})`);
 assert.equal(app.get('photoId').value,photo);assert.equal(app.get('product-photo-preview').src,'/api/profit/product-photos/'+photo);
 app.run(`restoreArchive({id:'record',productId:'product',name:'',specCode:'PHOTO-SPEC',productCode:'',version:1,snapshot:{fields:{photoId:'${photo}'}}})`);
 assert.equal(app.get('photoId').value,photo);
 await app.get('remove-product-photo').dispatch('click');assert.equal(app.get('photoId').value,'');
});

test('restored time inputs convert both ways, switch US regions and return to live time',async()=>{
 const app=calculator();
 app.get('cn-time').value='2026-11-10T10:13:55';await app.get('cn-time').dispatch('change');
 assert.equal(app.get('us-time').value,'2026-11-09T18:13:55');assert.equal(app.get('cn-clock').textContent,'10:13:55');assert.equal(app.run('clockLive'),false);
 app.get('us-time').value='2026-11-09T20:00:00';await app.get('us-time').dispatch('change');
 assert.equal(app.get('cn-time').value,'2026-11-10T12:00:00');
 app.get('zone-setting').value='America/New_York';await app.get('zone-setting').dispatch('change');
 assert.equal(app.get('us-time').value,'2026-11-09T23:00:00');assert.equal(app.get('time-gap').textContent,'北京快 13 小时');
 await app.get('time-now').dispatch('click');assert.equal(app.run('clockLive'),true);
 assert.equal(app.get('time-message').textContent,'');
});

test('restored date conversion handles DST gaps and repeated hours without altering calculation fields',async()=>{
 const app=calculator();app.get('chinaPrice').value='100';app.get('promotion').value='25';
 app.get('us-time').value='2026-03-08T02:30:00';await app.get('us-time').dispatch('change');
 assert.match(app.get('time-message').textContent,/跳时不存在/);assert.equal(app.get('time-message').classList.contains('input-error'),true);
 app.get('us-time').value='2026-11-01T01:30:00';await app.get('us-time').dispatch('change');
 assert.equal(app.get('time-fold').hidden,false);assert.equal(app.get('cn-time').value,'2026-11-01T16:30:00');
 app.get('time-occurrence').value='1';await app.get('time-occurrence').dispatch('change');assert.equal(app.get('cn-time').value,'2026-11-01T17:30:00');
 assert.equal(app.get('chinaPrice').value,'100');assert.equal(app.get('promotion').value,'25');
});

test('measurement labels distinguish new orders and reloaded revisions without changing save targets',async()=>{
 const requests=[];
 const app=calculator({fetch:async(url,options)=>{
  if(options?.method)requests.push({url,method:options.method});
  return {ok:true,json:async()=>({fields:{},id:'record',productId:'product',version:3})};
 }});
 app.load('settings.js');await app.run('defaultsReady');app.load('archive-db.js');
 assert.equal(app.get('measurement-mode').textContent,'第1版');
 app.get('archive-spec').value='LAYOUT-NEW';await app.run('saveProfit()');
 assert.equal(requests.at(-1).method,'POST');
 const product={id:'product',name:'演示商品',specCode:'LAYOUT-EXISTING',productCode:'',attribute:'',snapshot:{fields:{promotion:'21'}}};
 app.run(`loadProductMeasurement(${JSON.stringify(product)})`);
 assert.equal(app.get('measurement-mode').textContent,'第1版');
 await app.run('saveProfit()');assert.equal(requests.at(-1).method,'POST');
 app.run(`restoreArchive(${JSON.stringify({...product,id:'record',productId:'product',version:2,measurementSequence:3})})`);
 assert.equal(app.get('measurement-mode').textContent,'第2版');
 await app.run('saveProfit()');assert.equal(requests.at(-1).method,'PATCH');
 assert.equal(requests.at(-1).url,'/api/profit/records/record');
 app.run('beginNewMeasurement(false)');
 assert.equal(app.get('measurement-mode').textContent,'第1版');
 app.run(`loadProductMeasurement(${JSON.stringify(product)},'product')`);
 assert.equal(app.get('measurement-mode').textContent,'修改商品资料');
 await app.run('saveProfit()');assert.equal(requests.at(-1).method,'PUT');
 assert.equal(requests.at(-1).url,'/api/profit/products/product/measurement');
});
