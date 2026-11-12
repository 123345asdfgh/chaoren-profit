/* Local-only demo adapter for the standalone front-end package.
 * It keeps the formal UI unchanged and replaces API/auth calls with localStorage data.
 */
(function () {
  'use strict';
  if (window.__CHAOREN_DEMO_ADAPTER__) return;
  window.__CHAOREN_DEMO_ADAPTER__ = true;
  const originalFetch = window.fetch.bind(window);
  const storeKey = 'chaoren-formal-frontend-demo-v1';
  const now = () => new Date().toISOString();
  const defaults = {fx:6.8,multiplier:2.8,costRate:40,divisor:1.13,tax:25,promotion:25,operation:16,platform:7,royalty:7,labor:3,other:2,zone:'America/Los_Angeles'};
  const snapshot = (overrides={}) => ({fields:{photoId:'',attribute:'盲盒',chinaPrice:'39.9',salePrice:'18.5',buyerShipping:'0',receipt:'18.5',logistics:'51.1',currency:'RMB',fx:'6.8',multiplier:'2.8',costRate:'40',divisor:'1.13',tax:'25',promotion:'25',operation:'16',platform:'7',royalty:'7',labor:'3',other:'2',zone:'America/Los_Angeles',length:'20',width:'15',height:'10',weight:'0.2',packType:'parcel',store:'广州店铺',...overrides}});
  const baseProduct = {id:'demo-product-001',name:'宝可梦抱抱随行盲盒',specCode:'TEMP-COST-001',productCode:'DEMO-001',attribute:'盲盒',length:20,width:15,height:10,weight:.2,netRmb:58.42,netUsd:8.59,margin:.46,updatedAt:'2026-11-12T09:30:00.000Z',operatorName:'前端演示',snapshot:snapshot()};
  const baseTables = [{id:'demo-primary',name:'寄样记录',url:'https://demo.feishu.cn/base/demo',tableId:'tbl-primary',documentName:'2026年11月寄样记录',sourceType:'primary',updatedAt:'2026-11-12T09:30:00.000Z'},{id:'demo-secondary',name:'达人履约跟进',url:'https://demo.feishu.cn/base/demo-secondary',tableId:'tbl-secondary',documentName:'2026年11月达人履约',sourceType:'secondary',updatedAt:'2026-11-12T09:30:00.000Z'}];
  const baseRecord = {id:'demo-record-001',productId:baseProduct.id,name:baseProduct.name,specCode:baseProduct.specCode,productCode:baseProduct.productCode,category:'盲盒',operatorName:'前端演示',version:1,measurementSequence:1,netRmb:58.42,netUsd:8.59,margin:.46,savedAt:'2026-11-12T09:30:00.000Z',snapshot:baseProduct.snapshot};
  const clone = value => JSON.parse(JSON.stringify(value));
  const initial = () => { const record=clone(baseRecord); record.versions=[clone(baseRecord)]; return {settings:{...defaults},products:[clone(baseProduct)],records:[record],photos:{},tables:clone(baseTables),feishuConnected:true}; };
  function load(){try{const value=JSON.parse(localStorage.getItem(storeKey));if(value&&value.records)return value;}catch{}return initial();}
  function save(state){try{localStorage.setItem(storeKey,JSON.stringify(state));}catch{}}
  function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})}
  function text(body,status=200,type='text/plain;charset=utf-8'){return new Response(body,{status,headers:{'content-type':type}})}
  function urlOf(input){return new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href)}
  function bodyOf(init){try{return JSON.parse(init?.body||'{}')}catch{return {}}}
  function methodOf(init){return (init?.method||'GET').toUpperCase()}
  function valuesFrom(body){const fields=body?.snapshot?.fields||{};const result=body?.snapshot?.result||{};return {netRmb:result.netRmb??null,netUsd:result.netUsd??null,margin:result.margin??null, snapshot:body.snapshot||snapshot()}}
  function productFrom(body,id,old={}){const fields=body?.snapshot?.fields||{};const values=valuesFrom(body);return {...old,id,name:body.name||old.name||'',specCode:body.specCode||old.specCode||'',productCode:body.productCode||old.productCode||'',attribute:fields.attribute||old.attribute||'盲盒',length:Number(fields.length||old.length||0),width:Number(fields.width||old.width||0),height:Number(fields.height||old.height||0),weight:Number(fields.weight||old.weight||0),...values,updatedAt:now(),operatorName:'前端演示'};}
  function recordFrom(body,id,old={}){const values=valuesFrom(body);return {...old,id,productId:body.productId??old.productId??null,name:body.name??old.name??'',specCode:body.specCode??old.specCode??'',productCode:body.productCode??old.productCode??'',category:values.snapshot.fields.attribute||old.category||'盲盒',operatorName:'前端演示',...values,savedAt:now()};}
  function status(state){return {installed:true,connected:Boolean(state.feishuConnected),displayName:'前端演示',reason:state.feishuConnected?'':'已退出前端演示连接'};}
  function user(){return {id:'demo-user',phone:'13800000000',displayName:'前端演示',role:'user',mustChangePassword:false};}
  window.fetch = async function(input,init={}){
    const url=urlOf(input), path=url.pathname.replace(/^\/chaoren-profit(?=\/|$)/,'');
    if(!path.startsWith('/api/profit/')) return originalFetch(input,init);
    const state=load(), method=methodOf(init), body=bodyOf(init);
    if(path==='/api/profit/auth/session') return json({user:user()});
    if(path==='/api/profit/auth/login') return json({user:user()});
    if(path==='/api/profit/auth/logout') return json({ok:true});
    if(path==='/api/profit/auth/password') return json({user:user()});
    if(path==='/api/profit/settings'){
      if(method==='PUT'){state.settings={...state.settings,...(body.fields||{})};save(state)}
      return json({fields:clone(state.settings)});
    }
    if(path==='/api/profit/categories') return json({categories:['常规','盲盒','毛绒']});
    if(path==='/api/profit/products/suggestions'){
      const q=(url.searchParams.get('q')||'').toLowerCase();return json({products:state.products.filter(p=>[p.name,p.specCode,p.productCode].some(v=>String(v||'').toLowerCase().includes(q)))});
    }
    if(path==='/api/profit/products'){
      const q=(url.searchParams.get('specCode')||'').toLowerCase();const list=state.products.filter(p=>String(p.specCode||'').toLowerCase().includes(q));return json({products:list,total:list.length,page:Number(url.searchParams.get('page')||1),limit:Number(url.searchParams.get('limit')||10)});
    }
    const productMatch=path.match(/^\/api\/profit\/products\/([^/]+)(\/measurement)?$/);
    if(productMatch){
      const id=decodeURIComponent(productMatch[1]),index=state.products.findIndex(p=>p.id===id),product=state.products[index];
      if(!product)return json({error:'商品不存在'},404);
      if(productMatch[2]&&method==='PUT'){state.products[index]=productFrom(body,id,product);save(state);return json({product:state.products[index],saveTarget:'product',productId:id});}
      if(method==='DELETE'){state.products.splice(index,1);save(state);return json({ok:true});}
      return json(clone(product));
    }
    if(path==='/api/profit/records'&&method==='GET'){
      const q=(url.searchParams.get('q')||'').toLowerCase(),operator=(url.searchParams.get('operator')||'').toLowerCase(),cats=url.searchParams.getAll('category');
      let list=state.records.filter(r=>!q||[r.name,r.specCode,r.productCode].some(v=>String(v||'').toLowerCase().includes(q))).filter(r=>!operator||String(r.operatorName||'').toLowerCase().includes(operator)).filter(r=>!cats.length||cats.includes(r.category));
      const page=Math.max(1,Number(url.searchParams.get('page')||1)),limit=Math.max(1,Number(url.searchParams.get('limit')||10)),total=list.length;list=list.slice((page-1)*limit,page*limit);return json({records:clone(list),total,page,limit});
    }
    if(path==='/api/profit/records'&&method==='POST'){
      const id='demo-record-'+Date.now(),productId=body.productId||('demo-product-'+Date.now()),record=recordFrom(body,id,{id,productId,version:1,measurementSequence:1});record.versions=[clone(record)];state.records.unshift(record);const old=state.products.find(p=>p.id===productId);if(old)Object.assign(old,productFrom(body,productId,old));else state.products.unshift(productFrom(body,productId));save(state);return json(record);
    }
    const versionMatch=path.match(/^\/api\/profit\/records\/([^/]+)\/versions(?:\/([^/]+))?$/);
    if(versionMatch){const record=state.records.find(r=>r.id===decodeURIComponent(versionMatch[1]));if(!record)return json({error:'记录不存在'},404);if(versionMatch[2]){const version=record.versions?.find(v=>String(v.version)===versionMatch[2])||record;return json(clone(version));}return json({records:clone(record.versions||[record])});}
    const recordMatch=path.match(/^\/api\/profit\/records\/([^/]+)$/);
    if(recordMatch){const index=state.records.findIndex(r=>r.id===decodeURIComponent(recordMatch[1])),record=state.records[index];if(!record)return json({error:'记录不存在'},404);if(method==='PATCH'){const next=recordFrom(body,record.id,record);next.version=(record.version||1)+1;next.measurementSequence=next.version;next.versions=[...(record.versions||[record]),clone(next)];state.records[index]=next;const product=state.products.find(p=>p.id===next.productId);if(product)Object.assign(product,productFrom(body,product.id,product));save(state);return json(next);}if(method==='DELETE'){state.records.splice(index,1);save(state);return json({ok:true});}return json(clone(record));}
    if(path.startsWith('/api/profit/records/export')){const rows=['商品名称,规格编码,商品编码,净利润,利润率',...state.records.map(r=>[r.name,r.specCode,r.productCode,r.netRmb??'',r.margin==null?'':(r.margin*100).toFixed(2)+'%'].join(','))];return text(rows.join('\n'),200,'text/csv;charset=utf-8');}
    if(path==='/api/profit/product-photos'&&method==='POST'){const id='demo-photo-'+Date.now();state.photos[id]='';save(state);return json({photoId:id});}
    if(path.startsWith('/api/profit/product-photos/'))return text('',404);
    if(path.startsWith('/api/profit/creator-sampling/')){
      if(path.endsWith('/refresh'))return json({ok:true,cache:{ready:true,checking:false,lastChangedAt:'前端演示',lastCheckedAt:now()}});
      if(path.endsWith('/data')){try{const data=await originalFetch((location.pathname.startsWith('/chaoren-profit/')?'/chaoren-profit':'')+'/static-data/sampling.json').then(r=>r.json());return json({...data,cache:{ready:true,checking:false,lastChangedAt:'前端演示',lastCheckedAt:now()}})}catch{return json({rows:[],cache:{ready:true,checking:false}})}}
    }
    if(path==='/api/profit/feishu/status')return json(status(state));
    if(path==='/api/profit/feishu/login'){state.feishuConnected=true;save(state);return json(status(state));}
    if(path==='/api/profit/feishu/disconnect'){state.feishuConnected=false;save(state);return json({ok:true});}
    if(path==='/api/profit/feishu/saved-tables'&&method==='GET')return json({tables:clone(state.tables||[])});
    if(path==='/api/profit/feishu/saved-tables'&&method==='POST'){const urlValue=body.url||'https://demo.feishu.cn/base/demo',tableId=body.tableId||'tbl-demo',item={id:'demo-table-'+Date.now(),name:'数据表',url:urlValue,tableId,documentName:'前端演示表格',sourceType:'secondary',updatedAt:now()};state.tables=[item,...(state.tables||[])];save(state);return json(item);}
    const savedRead=path.match(/^\/api\/profit\/feishu\/saved-tables\/([^/]+)\/read$/);
    if(savedRead&&method==='POST')return json({name:'达人履约跟进',documentName:'2026年11月达人履约',columns:['日期','达人账号','商品','备注'],rows:[['2026-11-01','demo_creator_01','宝可梦抱抱随行盲盒','直播履约'],['2026-11-02','demo_creator_02','潮流毛绒挂件','视频履约']],complete:true});
    if(path==='/api/profit/feishu/tables'&&method==='POST')return json({tables:[{id:'tbl-demo',name:'数据表'}],selected:'tbl-demo'});
    if(path.startsWith('/api/profit/feishu/'))return json({error:'前端演示模式暂不连接真实飞书'},501);
    return json({error:'前端演示模式未实现该操作'},501);
  };
})();
