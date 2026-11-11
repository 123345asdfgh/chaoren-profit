const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup(historyReturn='/history?q=杯&page=2&limit=20'){
 class Element{
  constructor(){this.value='';this.events=new Map();this.open=false;this.returnValue='';this.classList={toggle(){}};}
  addEventListener(type,fn,options={}){const listeners=this.events.get(type)||[];listeners.push({fn,once:options.once});this.events.set(type,listeners)}
  dispatch(type,event={}){for(const listener of [...(this.events.get(type)||[])]){if(listener.once)this.events.set(type,this.events.get(type).filter(item=>item!==listener));listener.fn(event)}}
  focus(){}
  showModal(){this.open=true}
  close(value=''){this.returnValue=value;this.open=false;this.dispatch('close')}
 }
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
 const destinations=[];let catalogOpens=0;
 const sandbox={get,settings:[['fx'],['promotion']],URL,URLSearchParams,history:{replaceState(){}},location:{href:'http://localhost/calculator?'+new URLSearchParams({historyReturn}),search:'',origin:'http://localhost',assign:href=>destinations.push(href)},document:{activeElement:null,addEventListener(){}},activeRecordId:'record-1',savingMeasurement:false,applyMeasurementFields(){},ProductCatalog:{open:()=>catalogOpens++}};
 sandbox.window=sandbox;const context=vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(__dirname+'/measurement-navigation.js','utf8'),context);
 return {get,nav:sandbox.MeasurementNavigation,destinations,context,catalogOpens:()=>catalogOpens};
}

test('return destinations distinguish new orders, history revisions and catalog-only edits',async()=>{
 const app=setup();
 await app.nav.goBack();assert.equal(app.destinations[0],'/history?q=%E6%9D%AF&page=2&limit=20');
 app.nav.setContext('history');await app.nav.goBack();
 const destination=new URL(app.destinations[1],'http://localhost');
 assert.equal(destination.pathname,'/history/product/record-1');assert.equal(destination.searchParams.get('historyReturn'),app.destinations[0]);
 app.nav.setContext('product');await app.nav.goBack();
 assert.equal(app.catalogOpens(),1);assert.equal(app.destinations.length,2);assert.equal(app.get('save-return').textContent,'返回商品表');
});

test('cancel preserves unsaved changes; explicit discard is required before replacing a form',async()=>{
 const app=setup();app.get('archive-spec').value='UNSAVED';let replacements=0;
 assert.equal(app.nav.isDirty(),true);
 let pending=app.nav.run(()=>replacements++);
 assert.equal(app.get('unsaved-changes-dialog').open,true);assert.equal(replacements,0);
 app.get('unsaved-changes-dialog').close('cancel');assert.equal(await pending,false);assert.equal(replacements,0);assert.equal(app.nav.isDirty(),true);
 pending=app.nav.run(()=>replacements++);app.get('unsaved-changes-dialog').close('discard');
 assert.equal(await pending,true);assert.equal(replacements,1);
});

test('loading/saving establishes a clean baseline, but edits made during a save stay dirty',async()=>{
 const app=setup();app.get('promotion').value='55';app.nav.markClean();assert.equal(app.nav.isDirty(),false);
 app.get('promotion').value='60';const submitted=app.nav.capture();
 app.get('promotion').value='65';app.nav.markClean(submitted);assert.equal(app.nav.isDirty(),true);
 app.get('promotion').value='60';assert.equal(app.nav.isDirty(),false);
 app.context.savingMeasurement=true;await app.nav.goBack();assert.equal(app.destinations.length,0);
});

test('initial defaults and clock/search-only interactions do not create unsaved measurement edits',()=>{
 const app=setup();app.get('fx').value='7.2';app.nav.rebaseDefaults();assert.equal(app.nav.isDirty(),false);
 app.get('product-search').value='lookup';app.get('cn-time').value='2026-11-09T09:00';assert.equal(app.nav.isDirty(),false);
 app.get('promotion').value='55';app.get('promotion').dispatch('input');app.nav.rebaseDefaults();assert.equal(app.nav.isDirty(),true);
});

test('return URLs cannot send the user outside the history list',async()=>{
 for(const target of ['https://example.com/history','//example.com/history','/feishu']){const app=setup(target);await app.nav.goBack();assert.equal(app.destinations[0],'/history')}
});

test('returning to the catalog discards unsaved form edits before reopening the list',async()=>{
 const app=setup();app.nav.setContext('product');app.get('archive-spec').value='SAVED';app.nav.markClean();app.get('archive-spec').value='UNSAVED';
 const pending=app.nav.goBack();app.get('unsaved-changes-dialog').close('discard');await pending;
 assert.equal(app.catalogOpens(),1);assert.equal(app.get('archive-spec').value,'SAVED');assert.equal(app.nav.isDirty(),false);
});

test('the real save-success dialog offers a return target for all three save modes',()=>{
 const app=setup();vm.runInContext(fs.readFileSync(__dirname+'/archive-db.js','utf8'),app.context);
 const record={id:'record-1',productId:'product-1',specCode:'SAVED',name:'',version:2};
 vm.runInContext(`showSaved(${JSON.stringify(record)})`,app.context);
 assert.equal(app.get('save-success-dialog').open,true);assert.equal(app.get('save-return').textContent,'返回历史记录');
 app.nav.setContext('history');vm.runInContext(`showSaved(${JSON.stringify(record)})`,app.context);
 assert.equal(app.get('save-return').textContent,'返回本单详情');
 app.nav.setContext('product');vm.runInContext(`showSaved(${JSON.stringify({...record,saveTarget:'product'})})`,app.context);
 assert.equal(app.get('save-return').textContent,'返回商品表');assert.equal(app.get('save-success-dialog').open,true);
});
