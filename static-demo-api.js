/* GitHub Pages demo adapter.
 * The production app keeps its real API, auth, database and Redis. This file only
 * supplies local demo responses so the formal front-end can be browsed without login.
 */
(function () {
  'use strict';
  const originalFetch = window.fetch.bind(window);
  const storeKey = 'chaoren-pages-demo-state-v1';
  const defaults = {fx:6.8,multiplier:2.8,costRate:40,divisor:1.13,tax:25,promotion:25,operation:16,platform:7,royalty:7,labor:3,other:2,zone:'America/Los_Angeles'};
  const snapshot = (overrides={}) => ({
    fields:{photoId:'',attribute:'盲盒',chinaPrice:'39.9',salePrice:'18.5',buyerShipping:'0',receipt:'18.5',logistics:'51.1',currency:'RMB',fx:'6.8',multiplier:'2.8',costRate:'40',divisor:'1.13',tax:'25',promotion:'25',operation:'16',platform:'7',royalty:'7',labor:'3',other:'2',zone:'America/Los_Angeles',length:'20',width:'15',height:'10',weight:'0.2',packType:'parcel',store:'广州店铺',...overrides}
  });
  const baseProduct = {id:'demo-product-001',name:'宝可梦抱抱随行盲盒',specCode:'TEMP-COST-001',productCode:'DEMO-001',attribute:'盲盒',length:20,width:15,height:10,weight:.2,netRmb:58.42,netUsd:8.59,margin:.46,updatedAt:'2026-11-12T09:30:00.000Z',operatorName:'静态演示',snapshot:snapshot()};
  const baseRecord = {id:'demo-record-001',productId:baseProduct.id,name:baseProduct.name,specCode:baseProduct.specCode,productCode:baseProduct.productCode,category:'盲盒',operatorName:'静态演示',version:1,measurementSequence:1,netRmb:58.42,netUsd:8.59,margin:.46,savedAt:'2026-11-12T09:30:00.000Z',snapshot:baseProduct.snapshot};
  function load(){try{return JSON.parse(localStorage.getItem(storeKey))||{settings:{...defaults},products:[baseProduct],records:[baseRecord]};}catch{return {settings:{...defaults},products:[baseProduct],records:[baseRecord]};}}
  function save(state){try{localStorage.setItem(storeKey,JSON.stringify(state));}catch{}}
  function response(body,status=200,headers={'content-type':'application/json'}){return new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers});}
  function pathOf(input){return new URL(typeof input==='string'?input:input.url,location.href).pathname;}
  function qOf(input){return new URL(typeof input==='string'?input:input.url,location.href).searchParams;}
  function clone(value){return JSON.parse(JSON.stringify(value));}
  window.fetch = async function(input, init={}){
    const path=pathOf(input);
    if(!path.startsWith('/api/profit/')) return originalFetch(input,init);
    const state=load();
    if(path==='/api/profit/settings'){
      if((init.method||'GET').toUpperCase()==='PUT'){
        try{const body=JSON.parse(init.body||'{}');state.settings={...state.settings,...(body.fields||{})};save(state);}catch{}
      }
      return response({fields:clone(state.settings)});
    }
    if(path==='/api/profit/categories') return response({categories:['常规','盲盒','毛绒']});
    if(path==='/api/profit/products/suggestions'){
      const q=(qOf(input).get('q')||'').toLowerCase();return response({products:state.products.filter(p=>[p.name,p.specCode,p.productCode].some(v=>String(v||'').toLowerCase().includes(q)))});
    }
    if(path==='/api/profit/products'){
      const q=(qOf(input).get('specCode')||'').toLowerCase();const products=state.products.filter(p=>String(p.specCode).toLowerCase().includes(q));return response({products,total:products.length,page:1,limit:products.length||10});
    }
    const productMatch=path.match(/^\/api\/profit\/products\/([^/]+)(?:\/measurement)?$/);
    if(productMatch){
      const id=decodeURIComponent(productMatch[1]), product=state.products.find(p=>p.id===id);
      if(!product)return response({error:'商品不存在'},404);
      if(path.endsWith('/measurement')&&(init.method||'GET').toUpperCase()==='PUT'){
        try{const body=JSON.parse(init.body||'{}');Object.assign(product,body);product.snapshot=body.snapshot||product.snapshot;product.updatedAt=new Date().toISOString();save(state);return response({product,saveTarget:'product',productId:id});}catch{return response({error:'演示保存失败'},400);}
      }
      if((init.method||'GET').toUpperCase()==='DELETE'){state.products=state.products.filter(p=>p.id!==id);save(state);return response({ok:true});}
      return response(clone(product));
    }
    if(path==='/api/profit/records'&&(init.method||'GET').toUpperCase()==='POST'){
      let body={};try{body=JSON.parse(init.body||'{}');}catch{}
      const id='demo-record-'+Date.now();const record={...baseRecord,...body,id,version:1,measurementSequence:1,savedAt:new Date().toISOString(),snapshot:body.snapshot||snapshot()};state.records.unshift(record);save(state);return response(record);
    }
    const recordMatch=path.match(/^\/api\/profit\/records\/([^/]+)(?:\/versions\/([^/]+))?$/);
    if(recordMatch){
      const id=decodeURIComponent(recordMatch[1]), record=state.records.find(r=>r.id===id);
      if(!record)return response({error:'记录不存在'},404);
      if((init.method||'GET').toUpperCase()==='PATCH'){try{const body=JSON.parse(init.body||'{}');Object.assign(record,body);record.version=(record.version||1)+1;record.savedAt=new Date().toISOString();save(state);return response(record);}catch{return response({error:'演示保存失败'},400);}}
      if((init.method||'GET').toUpperCase()==='DELETE'){state.records=state.records.filter(r=>r.id!==id);save(state);return response({ok:true});}
      if(path.endsWith('/versions')) return response({records:[record]});
      return response(clone(record));
    }
    if(path==='/api/profit/records'){
      const records=state.records;return response({records,total:records.length,page:1,limit:records.length||10});
    }
    if(path.includes('/export')) return response('商品名称,规格编码,净利润\n'+state.records.map(r=>`${r.name},${r.specCode},${r.netRmb}`).join('\n'),200,{'content-type':'text/csv;charset=utf-8'});
    if(path.startsWith('/api/profit/creator-sampling/')){
      if(path.endsWith('/refresh')) return response({ok:true,cache:{ready:true,checking:false,lastChangedAt:'static-demo',lastCheckedAt:new Date().toISOString()}});
      if(path.endsWith('/data')){
        const data=await originalFetch('static-data/sampling.json').then(r=>r.json());
        return response({...data,cache:{ready:true,checking:false,lastChangedAt:'static-demo',lastCheckedAt:new Date().toISOString()}});
      }
    }
    return response({error:'静态演示版未实现该后端操作'},501);
  };
})();
