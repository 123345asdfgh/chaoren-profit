const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const FreightCore=require('./freight-core.js');
const DailyCore=require('./core.js');
const TimeCore=require('./time-core.js');

function calculator(){
 const elements=new Map(),timers=new Map();let timerId=0;
 function get(id){
  if(!elements.has(id)){
   const classes=new Set(),events={};
   elements.set(id,{id,value:'',textContent:'',validity:{valid:true},dataset:{},children:[],
    classList:{add:(...values)=>values.forEach(value=>classes.add(value)),remove:(...values)=>values.forEach(value=>classes.delete(value)),contains:value=>classes.has(value),toggle:(value,on)=>{if(on??!classes.has(value))classes.add(value);else classes.delete(value)}},
    addEventListener:(name,handler)=>(events[name]??=[]).push(handler),
    dispatch:async name=>{for(const handler of events[name]||[])await handler({})},
    replaceChildren(){},setAttribute(){},removeAttribute(){},checkValidity(){return true},closest(){return this}
   });
  }
  return elements.get(id);
 }
 for(const [id,value]of Object.entries({...DailyCore.DEFAULTS,zone:'America/Los_Angeles',currency:'RMB',packType:'parcel',store:'广州店铺',buyerShipping:0}))get(id).value=String(value);
 const context=vm.createContext({document:{getElementById:get,querySelector:()=>null,querySelectorAll:()=>[]},DailyCore,FreightCore,TimeCore,
  savedFreightSettings:FreightCore.cloneConfig(FreightCore.DEFAULT_CONFIG),window:{},Option:function(){},URLSearchParams,
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
