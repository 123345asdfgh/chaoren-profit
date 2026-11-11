const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup(historyReturn='/history?q=杯&page=2&limit=20',extra={}){
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
 const documentEvents=new Map(),windowEvents=new Map();
 const sandbox={addEventListener:(type,handler)=>windowEvents.set(type,handler),get,settings:[['fx'],['promotion']],URL,URLSearchParams,history:{replaceState(){}},location:{href:'http://localhost/calculator?'+new URLSearchParams({historyReturn,...extra}),search:'',origin:'http://localhost',assign:href=>destinations.push(href)},document:{activeElement:null,addEventListener:(type,handler)=>documentEvents.set(type,handler)},activeRecordId:'record-1',savingMeasurement:false,applyMeasurementFields(){},ProductCatalog:{open:()=>catalogOpens++}};
 sandbox.window=sandbox;const context=vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(__dirname+'/measurement-navigation.js','utf8'),context);
 return {get,nav:sandbox.MeasurementNavigation,destinations,context,documentEvents,windowEvents,catalogOpens:()=>catalogOpens};
}

test('return destinations distinguish new orders, history revisions and catalog-only edits',async()=>{
 const app=setup(undefined,{returnTo:'detail'});
 await app.nav.goBack();assert.equal(app.destinations[0],'/history?q=%E6%9D%AF&page=2&limit=20');
 app.nav.setContext('history');await app.nav.goBack();
 const destination=new URL(app.destinations[1],'http://localhost');
 assert.equal(destination.pathname,'/history/product/record-1');assert.equal(destination.searchParams.get('historyReturn'),app.destinations[0]);
 app.nav.setContext('product');await app.nav.goBack();
 const catalog=new URL(app.destinations[2],'http://localhost');
 assert.equal(catalog.pathname,'/history');assert.equal(catalog.searchParams.get('catalog'),'1');assert.equal(catalog.searchParams.get('q'),'杯');assert.equal(catalog.searchParams.get('page'),'2');
 assert.equal(app.catalogOpens(),0);assert.equal(app.get('save-return').textContent,'返回商品表');
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

test('catalog return navigates out of the editor, preserving its search and page',async()=>{
 const app=setup(undefined,{catalogQuery:'SPEC 001',catalogPage:'3',catalogLimit:'20'});app.nav.setContext('product');
 app.get('archive-spec').value='SAVED';app.nav.markClean();app.get('archive-spec').value='UNSAVED';
 let pending=app.nav.goBack();app.get('unsaved-changes-dialog').close('cancel');await pending;assert.equal(app.destinations.length,0);
 pending=app.nav.goBack();app.get('unsaved-changes-dialog').close('discard');await pending;
 const target=new URL(app.destinations[0],'http://localhost');
 assert.equal(target.pathname,'/history');assert.equal(target.searchParams.get('catalog'),'1');assert.equal(target.searchParams.get('catalogQuery'),'SPEC 001');assert.equal(target.searchParams.get('catalogPage'),'3');assert.equal(target.searchParams.get('catalogLimit'),'20');
 assert.equal(app.catalogOpens(),0);
});

test('an inline catalog edit returns to the catalog state where it was opened',async()=>{
 const app=setup();app.nav.setCatalogState({query:'毛绒',page:4,limit:10});app.nav.setContext('product');await app.nav.goBack();
 const target=new URL(app.destinations[0],'http://localhost');assert.equal(target.searchParams.get('catalogQuery'),'毛绒');assert.equal(target.searchParams.get('catalogPage'),'4');
 app.nav.setContext('new');await app.nav.goBack();assert.equal(new URL(app.destinations[1],'http://localhost').searchParams.has('catalog'),false);
});

test('sidebar navigation guards unsaved edits and then reaches the chosen page',async()=>{
 const app=setup();app.get('archive-spec').value='UNSAVED';
 const event={button:0,target:{closest:()=>({id:'',href:'http://localhost/feishu',hasAttribute:()=>false})},preventDefault(){this.defaultPrevented=true}};
 app.documentEvents.get('click')(event);assert.equal(event.defaultPrevented,true);assert.equal(app.get('unsaved-changes-dialog').open,true);
 app.get('unsaved-changes-dialog').close('cancel');await new Promise(resolve=>setImmediate(resolve));assert.equal(app.destinations.length,0);
 event.defaultPrevented=false;app.documentEvents.get('click')(event);app.get('unsaved-changes-dialog').close('discard');await new Promise(resolve=>setImmediate(resolve));assert.equal(app.destinations[0],'http://localhost/feishu');
});

test('the real save-success dialog offers a return target for all three save modes',()=>{
 const app=setup(undefined,{returnTo:'detail'});vm.runInContext(fs.readFileSync(__dirname+'/archive-db.js','utf8'),app.context);
 const record={id:'record-1',productId:'product-1',specCode:'SAVED',name:'',version:2};
 vm.runInContext(`showSaved(${JSON.stringify(record)})`,app.context);
 assert.equal(app.get('save-success-dialog').open,true);assert.equal(app.get('save-return').textContent,'返回历史记录');
 app.nav.setContext('history');vm.runInContext(`showSaved(${JSON.stringify(record)})`,app.context);
 assert.equal(app.get('save-return').textContent,'返回本单详情');
 app.nav.setContext('product');vm.runInContext(`showSaved(${JSON.stringify({...record,saveTarget:'product'})})`,app.context);
 assert.equal(app.get('save-return').textContent,'返回商品表');assert.equal(app.get('save-success-dialog').open,true);
});

test('list order edits return to history while explicit detail entry returns to the order',async()=>{
 const app=setup();app.nav.setContext('history');await app.nav.goBack();assert.equal(new URL(app.destinations[0],'http://localhost').pathname,'/history');
 const detail=setup(undefined,{returnTo:'detail'});detail.nav.setContext('history');await detail.nav.goBack();assert.equal(new URL(detail.destinations[0],'http://localhost').pathname,'/history/product/record-1');
});
test('browser back, refresh and close guard dirty forms; approved links do not prompt twice',async()=>{
 const app=setup();const event=()=>({preventDefault(){this.prevented=true}});let e=event();app.windowEvents.get('beforeunload')(e);assert.equal(e.prevented,undefined);
 app.get('weight').value='2';e=event();app.windowEvents.get('beforeunload')(e);assert.equal(e.prevented,true);assert.equal(e.returnValue,'');
 const leave=app.nav.goBack();app.get('unsaved-changes-dialog').close('discard');await leave;e=event();app.windowEvents.get('beforeunload')(e);assert.equal(e.prevented,undefined);
 app.windowEvents.get('pageshow')();e=event();app.windowEvents.get('beforeunload')(e);assert.equal(e.prevented,true);
});
test('unsaved comparison changes are included in browser leave protection',()=>{
 const app=setup();app.context.ComparisonNavigation={isDirty:()=>true};assert.equal(app.nav.isDirty(),true);
 const event={preventDefault(){this.prevented=true}};app.windowEvents.get('beforeunload')(event);assert.equal(event.prevented,true);
});

 test('browser Back can cancel without losing form data and discard reaches the previous document',async()=>{
  const app=setup();let backwards=0,forwards=0;
  const history=app.context.history;history.state=null;history.replaceState=state=>{history.state=state};history.pushState=state=>{history.state=state};history.back=()=>backwards++;history.forward=()=>forwards++;
  vm.runInContext(fs.readFileSync(__dirname+'/measurement-navigation.js','utf8'),app.context);
  const base={measurementGuard:{...history.state.measurementGuard,role:'base'}};
  app.get('archive-name').value='保持未保存的输入';
  let pending=app.windowEvents.get('popstate')({state:base});app.get('unsaved-changes-dialog').close('cancel');await pending;assert.equal(forwards,1);assert.equal(backwards,0);assert.equal(app.get('archive-name').value,'保持未保存的输入');
  await app.windowEvents.get('popstate')({state:history.state});
  pending=app.windowEvents.get('popstate')({state:base});app.get('unsaved-changes-dialog').close('discard');await pending;assert.equal(backwards,1);
 });
