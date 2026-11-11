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
    replaceChildren(){},setAttribute(){},removeAttribute(){},closest(){return this}
   });
  }
  return elements.get(id);
 }
 for(const [id,value]of Object.entries({...DailyCore.DEFAULTS,zone:'America/Los_Angeles',currency:'RMB',packType:'parcel',store:'广州店铺',buyerShipping:0}))get(id).value=String(value);
 const context=vm.createContext({document:{getElementById:get,querySelector:()=>null},DailyCore,FreightCore,TimeCore,
  savedFreightSettings:FreightCore.cloneConfig(FreightCore.DEFAULT_CONFIG),window:{},Option:function(){},URLSearchParams,
  setInterval(){},setTimeout:handler=>{timers.set(++timerId,handler);return timerId},clearTimeout:id=>timers.delete(id),
  apiRequest:async()=>({products:[]})});
 const run=source=>vm.runInContext(source,context);
 const load=file=>run(fs.readFileSync(__dirname+'/'+file,'utf8'));
 load('app.js');
 function parcel(values={}){for(const [id,value]of Object.entries({length:20,width:15,height:10,weight:.2,attribute:'普货',...values}))get(id).value=String(value);}
 return {get,run,load,parcel,async lookup(){const pending=[...timers.values()];timers.clear();for(const callback of pending)await callback();await new Promise(resolve=>setImmediate(resolve));}};
}

test('changing to overweight, oversize or invalid goods clears the previous quote and profit',()=>{
 for(const invalid of [{weight:10.01},{length:100,width:100,height:100},{weight:0}]){
  const app=calculator();app.parcel();app.run("get('chinaPrice').value='100';referencePrice();updateFreightQuote(true);renderProfit()");
  assert.equal(app.get('logistics').value,'50.1');
  app.parcel(invalid);app.run('updateFreightQuote(true);renderProfit()');
  assert.equal(app.get('logistics').value,'');assert.equal(app.get('net').textContent,'—');
  assert.equal(app.get('logistics-source').classList.contains('input-error'),true);
  assert.equal(app.get('message').classList.contains('error'),true);
  app.parcel();app.run('updateFreightQuote(true);renderProfit()');
  assert.equal(app.get('logistics').value,'50.1');assert.equal(app.get('logistics-source').classList.contains('input-error'),false);
  assert.equal(app.get('message').classList.contains('error'),false);
 }
});

test('name changes clear costs immediately and unknown goods show a red hint',async()=>{
 const app=calculator();app.load('product-catalog.js');app.parcel();app.run('updateFreightQuote(true)');
 app.get('archive-name').value='未录入的商品';await app.get('archive-name').dispatch('input');
 assert.equal(app.get('logistics').value,'');assert.equal(app.get('length-display').value,'—');
 await app.lookup();assert.match(app.get('product-name-hint').textContent,/尚未录入/);
 assert.equal(app.get('product-name-hint').classList.contains('input-error'),true);
 app.get('archive-name').value='';await app.get('archive-name').dispatch('input');
 assert.equal(app.get('product-name-hint').classList.contains('input-error'),false);
});

test('loading a historical manual cost preserves it even when no automatic quote is available',()=>{
 const app=calculator();app.parcel({weight:20});app.get('logistics').value='168';app.run('updateFreightQuote()');
 assert.equal(app.get('logistics').value,'168');
 app.parcel({weight:''});app.run('updateFreightQuote()');assert.equal(app.get('logistics').value,'168');
});

test('comparison also clears failed estimates and retains historical manual costs on initial load',()=>{
 const app=calculator();app.load('compare-ui.js');
 for(const [id,value]of Object.entries({length:20,width:15,height:10,weight:20,store:'广州店铺',packType:'parcel',currency:'RMB',logistics:168}))app.get('compare-'+id).value=String(value);
 app.get('attribute').value='普货';app.run('compareFreightSettings=savedFreightSettings;updateCompareFreightQuote()');
 assert.equal(app.get('compare-logistics').value,'168');
 app.run('updateCompareFreightQuote(true)');assert.equal(app.get('compare-logistics').value,'');
});
