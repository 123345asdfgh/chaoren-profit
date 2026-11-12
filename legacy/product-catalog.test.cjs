const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('catalog deletion waits for confirmation; cancel and Escape leave the product intact',async()=>{
 class Element{
  constructor(){this.children=[];this.events=new Map();this.value='';this.disabled=false;this.returnValue='';this.classList={toggle(){}};}
  addEventListener(type,handler,options={}){const listeners=this.events.get(type)||[];listeners.push({handler,once:options.once});this.events.set(type,listeners);}
  async dispatch(type){const listeners=[...(this.events.get(type)||[])];for(const listener of listeners){if(listener.once)this.events.set(type,this.events.get(type).filter(item=>item!==listener));await listener.handler({preventDefault(){}});}}
  click(){return this.disabled?Promise.resolve():this.dispatch('click');}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  setAttribute(){}
  removeAttribute(){}
  focus(){}
  showModal(){this.open=true;}
  close(value=''){this.returnValue=value;this.open=false;return this.dispatch('close');}
 }
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 get('catalog-page-size').value='10';
 const fixture={id:'test-product',name:'测试商品',specCode:'SPEC-DELETE',productCode:'',updatedAt:'2026-11-06T00:00:00Z'};
 let products=[fixture];const requests=[];
 const context=vm.createContext({get,document:{querySelectorAll:()=>[],createElement:()=>new Element()},URLSearchParams,setTimeout,clearTimeout,defaultsReady:Promise.resolve(),activeProductId:null,measurementMode:'new',money:String,
  apiRequest:async(url,options={})=>{requests.push({url,...options});if(options.method==='DELETE'){products=[];return {deleted:true}}return {products,total:products.length};}});
 vm.runInContext(fs.readFileSync(__dirname+'/product-catalog.js','utf8'),context);
 await get('open-products').click();await new Promise(resolve=>setImmediate(resolve));
 const remove=get('catalog-rows').children[0].children.at(-1).children[1];
 const deleted=()=>requests.filter(request=>request.method==='DELETE');
 for(const cancellation of ['cancel','']){
  const pending=remove.click();assert.equal(get('catalog-delete-dialog').open,true);assert.equal(deleted().length,0);
  assert.equal(get('catalog-delete-product').textContent,'测试商品 · 规格编码：SPEC-DELETE');
  await get('catalog-delete-dialog').close(cancellation);await pending;
  assert.equal(deleted().length,0);assert.equal(remove.disabled,false);
 }
 const pending=remove.click();await remove.click();assert.equal(deleted().length,0);
 await get('catalog-delete-dialog').close('delete');await pending;
 assert.equal(deleted().length,1);assert.equal(deleted()[0].url,'/products/test-product');
 assert.equal(get('catalog-total').textContent,'共 0 条');
});
