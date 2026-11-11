'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import TimeDisplay from '../shared-time';
import type {FreightConfig,FreightEstimate} from './freight-details';
import '../shared.css';
import './history-list.css';
import {withHistoryReturn} from './return-navigation';

type RecordItem={id:string;productId:string|null;name:string;category:string;specCode:string;productCode:string;operatorName:string|null;version:number;measurementSequence:number;previousVersion:number|null;netRmb:number|null;netUsd:number|null;margin:number|null;savedAt:string;previousSnapshot:unknown;snapshot:{fields:Record<string,string>;freight?:FreightConfig;quote?:FreightEstimate|null}};
type ProductItem={id:string;name:string;specCode:string;productCode:string;attribute:string;operatorName:string|null;netRmb:number|null;margin:number|null;weight:number|null;updatedAt:string};
type ActionModal={stage:'confirm'|'result';kind:'restore'|'delete';row:RecordItem;title:string;message:string};
const money=(value:number|null)=>value===null?'—':'¥'+value.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const profitTone=(value:number|null)=>value===null||!Number.isFinite(value)||value===0?'neutral':value>0?'positive':'negative';
const baseCategories=['常规','盲盒','毛绒'];

export default function History(){
 const [query,setQuery]=useState('');
 const [categories,setCategories]=useState<string[]>([]);
 const [availableCategories,setAvailableCategories]=useState(baseCategories);
 const [operator,setOperator]=useState('');
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const [page,setPage]=useState(1);
 const [limit,setLimit]=useState(10);
 const [filtersReady,setFiltersReady]=useState(false);
 const [records,setRecords]=useState<RecordItem[]>([]);
 const [total,setTotal]=useState(0);
 const [message,setMessage]=useState('');
 const [loading,setLoading]=useState(true);
 const [exporting,setExporting]=useState(false);
 const [actionModal,setActionModal]=useState<ActionModal|null>(null);
 const [acting,setActing]=useState(false);
 const [catalogOpen,setCatalogOpen]=useState(false);
 const [catalogQuery,setCatalogQuery]=useState('');
 const [catalogPage,setCatalogPage]=useState(1);
 const [catalogLimit,setCatalogLimit]=useState(10);
 const [catalogProducts,setCatalogProducts]=useState<ProductItem[]>([]);
 const [catalogTotal,setCatalogTotal]=useState(0);
 const [catalogLoading,setCatalogLoading]=useState(false);
 const [catalogMessage,setCatalogMessage]=useState('');
 const [catalogDelete,setCatalogDelete]=useState<ProductItem|null>(null);
 const requestSerial=useRef(0);
 const modalButton=useRef<HTMLButtonElement>(null);
 const filterParams=useCallback(()=>{const params=new URLSearchParams({q:query,operator});for(const category of categories)params.append('category',category);if(from)params.set('from',from);if(to)params.set('to',to);return params},[query,categories,operator,from,to]);
 const listParams=filterParams();listParams.set('page',String(page));listParams.set('limit',String(limit));
 for(const key of ['q','operator'])if(!listParams.get(key))listParams.delete(key);
 const listHref='/history?'+listParams.toString();
 const catalogParams=new URLSearchParams(listParams);
 catalogParams.set('catalog','1');catalogParams.set('catalogQuery',catalogQuery);catalogParams.set('catalogPage',String(catalogPage));catalogParams.set('catalogLimit',String(catalogLimit));
 const catalogHref='/history?'+catalogParams.toString();
 const pageHref=catalogOpen?catalogHref:listHref;
 const editProductHref=(id:string)=>{const url=new URL(withHistoryReturn('/calculator?product='+encodeURIComponent(id),listHref),'http://history.local');url.searchParams.set('catalogQuery',catalogQuery);url.searchParams.set('catalogPage',String(catalogPage));url.searchParams.set('catalogLimit',String(catalogLimit));return url.pathname+url.search};
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  setQuery(params.get('q')||'');setOperator(params.get('operator')||'');setCategories(params.getAll('category').filter(Boolean));
  for(const [key,setter]of [['from',setFrom],['to',setTo]] as const){const value=params.get(key)||'';setter(/^\d{4}-\d{2}-\d{2}$/.test(value)?value:'')}
  const requestedPage=Number(params.get('page')),requestedLimit=Number(params.get('limit'));
  setPage(Number.isSafeInteger(requestedPage)&&requestedPage>0?requestedPage:1);setLimit([10,20,50].includes(requestedLimit)?requestedLimit:10);
  const productPage=Number(params.get('catalogPage')),productLimit=Number(params.get('catalogLimit'));
  setCatalogOpen(params.get('catalog')==='1');setCatalogQuery(params.get('catalogQuery')||'');setCatalogPage(Number.isSafeInteger(productPage)&&productPage>0?productPage:1);setCatalogLimit([10,20,50].includes(productLimit)?productLimit:10);setFiltersReady(true);
 },[]);
 useEffect(()=>{if(filtersReady)window.history.replaceState(window.history.state,'',pageHref)},[filtersReady,pageHref]);
 const refresh=useCallback(async()=>{const serial=++requestSerial.current;setLoading(true);try{const params=filterParams();params.set('page',String(page));params.set('limit',String(limit));const response=await fetch('/api/profit/records?'+params);const data=await response.json();if(serial!==requestSerial.current)return;if(!response.ok)throw Error(data.error||'加载失败');if(page>1&&data.total<=(page-1)*limit){setPage(Math.max(1,Math.ceil(data.total/limit)));return}setRecords(data.records);setTotal(data.total);setMessage('')}catch(error){if(serial===requestSerial.current)setMessage((error as Error).message)}finally{if(serial===requestSerial.current)setLoading(false)}},[filterParams,page,limit]);
 useEffect(()=>{if(filtersReady)void refresh()},[refresh,filtersReady]);
 useEffect(()=>{fetch('/api/profit/categories').then(async response=>{if(response.ok){const data=await response.json();setAvailableCategories(Array.from(new Set([...baseCategories,...data.categories])))}}).catch(()=>{})},[]);
 useEffect(()=>{if(!actionModal)return;modalButton.current?.focus();const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!acting)setActionModal(null)};window.addEventListener('keydown',onKeyDown);return()=>window.removeEventListener('keydown',onKeyDown)},[actionModal,acting]);
 useEffect(()=>{if(!catalogOpen)return;let active=true;setCatalogLoading(true);setCatalogMessage('');const params=new URLSearchParams({specCode:catalogQuery,page:String(catalogPage),limit:String(catalogLimit)});fetch('/api/profit/products?'+params).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'商品资料读取失败');if(active){setCatalogProducts(data.products);setCatalogTotal(data.total)}}).catch(error=>{if(active){setCatalogProducts([]);setCatalogMessage(error instanceof Error?error.message:'商品资料读取失败') }}).finally(()=>{if(active)setCatalogLoading(false)});return()=>{active=false}},[catalogOpen,catalogQuery,catalogPage,catalogLimit]);
 function openAction(row:RecordItem,kind:'restore'|'delete'){setActionModal({stage:'confirm',kind,row,title:kind==='restore'?'恢复上一版':'删除记录',message:kind==='restore'?`将“${row.name||row.specCode}”恢复为第 ${row.previousVersion} 版，其他版本保留。`:`“${row.name||row.specCode}”及全部历史版本将被删除，无法恢复。`})}
 async function confirmAction(){if(!actionModal||actionModal.stage!=='confirm')return;const {row,kind}=actionModal;setActing(true);try{const response=await fetch('/api/profit/records/'+row.id+(kind==='restore'?'/restore':''),{method:kind==='restore'?'POST':'DELETE'});const data=await response.json();if(!response.ok)throw Error(data.error||'操作失败');await refresh();setActionModal({stage:'result',kind,row,title:kind==='restore'?'恢复成功':'删除成功',message:kind==='restore'?`当前第 ${data.version} 版。`:''})}catch(error){setActionModal({stage:'result',kind,row,title:'操作未完成',message:(error as Error).message})}finally{setActing(false)}}
 async function exportExcel(){setExporting(true);try{const response=await fetch('/api/profit/records/export?'+filterParams());if(!response.ok){const data=await response.json();throw Error(data.error||'导出失败')}const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='历史测算.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('已导出当前筛选范围内的全部记录。')}catch(error){setMessage((error as Error).message)}finally{setExporting(false)}}
 async function deleteCatalogProduct(){if(!catalogDelete)return;const product=catalogDelete;setCatalogLoading(true);try{const response=await fetch('/api/profit/products/'+encodeURIComponent(product.id),{method:'DELETE'});const data=await response.json();if(!response.ok)throw Error(data.error||'删除商品失败');setCatalogDelete(null);setCatalogMessage('已删除商品资料，已有历史记录保留。');setCatalogPage(1);const params=new URLSearchParams({specCode:catalogQuery,page:'1',limit:String(catalogLimit)});const refresh=await fetch('/api/profit/products?'+params);const refreshed=await refresh.json();if(refresh.ok){setCatalogProducts(refreshed.products);setCatalogTotal(refreshed.total)}}catch(error){setCatalogMessage(error instanceof Error?error.message:'删除商品失败')}finally{setCatalogLoading(false)}}
 const filter=(setter:(value:string)=>void)=>(event:React.ChangeEvent<HTMLInputElement>)=>{setPage(1);setter(event.target.value)};
 const toggleCategory=(category:string)=>{setPage(1);setCategories(current=>current.includes(category)?current.filter(value=>value!==category):[...current,category])};
 const hasFilter=Boolean(query||categories.length||operator||from||to);
 return <main className="history-page">
  <header className="history-top brand-banner">
   <div className="brand-watermark" aria-hidden="true">GO GLOBAL<span>让好产品，走向世界</span></div>
   <div className="history-brand-lockup brand-banner-logo"><Image src="/legacy/assets/chaoren-logo.png" width={252} height={142} alt="CHAOREN AI"/></div>
   <div className="history-brand-copy brand-banner-copy"><div className="brand-eyebrow"><span></span>CHAOREN AI <i>/</i> 跨境经营工作台</div><div className="history-brand-title brand-heading"><h1>历史操作日志</h1><span className="history-market-badge brand-banner-market">US TiKTOK shop</span></div><p className="brand-description">看清成本，让每一次出海更有底气。<span>商品档案 · 利润测算 · 历史追踪</span></p><div className="history-entry-actions brand-actions"><button type="button" className="history-catalog-button" aria-haspopup="dialog" onClick={()=>{setCatalogOpen(true);setCatalogPage(1)}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 9 5-9 5-9-5 9-5Zm-9 7 8 4.5V23l-8-4.5V9Zm10 4.5L21 9v9.5L13 23v-9.5Z"/></svg>商品表</button><Link className="history-new-product" href={withHistoryReturn('/calculator',listHref)}>＋ 新增商品</Link></div></div>
   <div className="history-brand-scene brand-banner-scene"><div className="brand-orbit-label" aria-hidden="true">FROM LOCAL TO GLOBAL</div><p className="brand-banner-slogan">好潮玩，让全球玩家知道<span aria-hidden="true">⌁</span></p><Image src="/legacy/assets/chaoren-mascot.png" width={181} height={136} alt="蓝绿色超韧猫咪背靠美金钞票堆"/></div>
  </header>

  {catalogOpen&&<div className="history-catalog-overlay" role="dialog" aria-modal="true" aria-labelledby="history-catalog-title"><section className="history-catalog-dialog"><header><h2 id="history-catalog-title">商品表</h2><button type="button" onClick={()=>setCatalogOpen(false)}>关闭 ✕</button></header><div className="history-catalog-body"><div className="history-catalog-heading"><h3>商品资料 <small>共 {catalogTotal} 条</small></h3><button type="button" onClick={()=>{setCatalogPage(1);setCatalogMessage('')}}>刷新</button></div><form className="history-catalog-filter" onSubmit={event=>{event.preventDefault();setCatalogPage(1)}}><label>规格编码<input value={catalogQuery} onChange={event=>setCatalogQuery(event.target.value)} placeholder="输入规格编码搜索"/></label><button type="submit">查询</button><button type="button" onClick={()=>{setCatalogQuery('');setCatalogPage(1)}}>重置</button></form>{catalogMessage&&<p className="history-catalog-message">{catalogMessage}</p>}<div className="history-catalog-table-wrap"><table className="history-catalog-table"><thead><tr><th>序号</th><th>商品名称</th><th>规格编码</th><th>商品编码</th><th>商品属性</th><th>净利润<br/>RMB</th><th>净利润率</th><th>实重<br/>kg</th><th>更新时间</th><th>操作人</th><th>操作</th></tr></thead><tbody>{catalogLoading?<tr><td colSpan={11}>正在读取商品资料…</td></tr>:catalogProducts.length===0?<tr><td colSpan={11}>暂无匹配商品</td></tr>:catalogProducts.map((product,index)=><tr key={product.id}><td>{(catalogPage-1)*catalogLimit+index+1}</td><td className="catalog-product-name">{product.name||'—'}</td><td>{product.specCode}</td><td>{product.productCode||'—'}</td><td>{product.attribute||'—'}</td><td className={profitTone(product.netRmb)}>{money(product.netRmb)}</td><td className={profitTone(product.margin)}>{product.margin===null?'—':(product.margin*100).toFixed(2)+'%'}</td><td>{product.weight??'—'}</td><td>{new Date(product.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}</td><td>{product.operatorName||'未记录'}</td><td><div className="history-catalog-actions"><Link href={editProductHref(product.id)}>修改</Link><button type="button" onClick={()=>setCatalogDelete(product)}>删除</button></div></td></tr>)}</tbody></table></div><footer className="history-catalog-pagination"><label>每页显示 <select value={catalogLimit} onChange={event=>{setCatalogPage(1);setCatalogLimit(Number(event.target.value))}}><option value={10}>10 条</option><option value={20}>20 条</option><option value={50}>50 条</option></select></label><span>第 {catalogPage} / {Math.max(1,Math.ceil(catalogTotal/catalogLimit))} 页</span><button type="button" disabled={catalogPage<=1} onClick={()=>setCatalogPage(page=>page-1)}>上一页</button><button type="button" disabled={catalogPage>=Math.max(1,Math.ceil(catalogTotal/catalogLimit))} onClick={()=>setCatalogPage(page=>page+1)}>下一页</button></footer></div></section></div>}
  {catalogDelete&&<div className="history-catalog-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="history-catalog-confirm-title"><section className="history-catalog-confirm"><h2 id="history-catalog-confirm-title">确认删除商品？</h2><p>{catalogDelete.name||'未命名商品'} · 规格编码：{catalogDelete.specCode}</p><small>删除后不可恢复，已有历史记录保留。</small><div><button type="button" onClick={()=>setCatalogDelete(null)}>取消</button><button type="button" className="danger" onClick={()=>void deleteCatalogProduct()}>确认删除</button></div></section></div>}
  <TimeDisplay/>
  <section className="filters">
   <label className="history-search-field">商品名称 / 规格编码 / 商品编码<input value={query} onChange={filter(setQuery)} placeholder="搜索商品名称、规格编码或商品编码"/></label>
   <label>操作人<input value={operator} onChange={filter(setOperator)} placeholder="姓名"/></label>
   <div className="category-filter"><span>商品属性</span><details><summary>{categories.length?`已选 ${categories.length} 项`:'全部属性'}</summary><div className="category-options">{availableCategories.map(category=><label key={category}><input type="checkbox" checked={categories.includes(category)} onChange={()=>toggleCategory(category)}/>{category}</label>)}</div></details></div>
   <label>开始日期<input type="date" value={from} onChange={filter(setFrom)}/></label><label>结束日期<input type="date" value={to} onChange={filter(setTo)}/></label>
  </section>
  <section className="record-list">
   <div className="list-head"><h2>操作日志 <small>共 {total} 条</small></h2><div className="history-list-tools"><button type="button" disabled={loading||exporting||total===0} onClick={()=>void exportExcel()}>{exporting?'导出中…':'导出 Excel'}</button>{loading&&<span>加载中…</span>}</div></div>
   {message&&<p role="status" className="feedback">{message}</p>}
   {!loading&&!message&&records.length===0&&<p>{hasFilter?'没有符合条件的记录。':'暂无历史记录。'}</p>}
   {!loading&&records.length>0&&<div className="history-record-table-wrap"><table className="history-record-table"><thead><tr><th>商品图片</th><th>商品名称</th><th>规格编码</th><th>商品编码</th><th>商品属性</th><th>净利润</th><th>利润率</th><th>最近保存</th><th>操作人</th><th>操作</th></tr></thead><tbody>{records.map(row=>{const photoId=row.snapshot.fields.photoId;return <tr key={row.id}>
    <td>{photoId&&/^[0-9a-f-]{36}$/i.test(photoId)?<Image className="history-record-photo" unoptimized src={'/api/profit/product-photos/'+photoId} width={52} height={52} alt={row.name||'商品图片'}/>:<div className="history-record-photo history-record-photo-empty" aria-label="暂无商品图片"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg></div>}</td>
    <td className="history-record-name"><strong>{row.name||'—'}</strong><small>第 {row.version} 版</small></td><td>{row.specCode}</td><td>{row.productCode||'—'}</td><td>{row.category||'—'}</td><td className={"history-record-amount "+profitTone(row.netRmb)}>{money(row.netRmb)}</td><td className={profitTone(row.margin)}>{row.margin===null?'—':(row.margin*100).toFixed(2)+'%'}</td><td>{new Date(row.savedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</td><td>{row.operatorName||'未记录'}</td>
    <td><div className="record-actions"><Link href={withHistoryReturn(`/history/product/${row.id}`,listHref)}>操作详情</Link><Link href={withHistoryReturn(`/calculator?record=${encodeURIComponent(row.id)}`,listHref)}>订单修改</Link><button disabled={!row.previousSnapshot} onClick={()=>openAction(row,'restore')}>{row.previousSnapshot?`恢复第 ${row.previousVersion} 版`:'恢复上一版'}</button><button className="danger" onClick={()=>openAction(row,'delete')}>删除</button></div></td>
   </tr>})}</tbody></table></div>}
   <div className="pagination"><label>每页显示 <select value={limit} onChange={event=>{setPage(1);setLimit(Number(event.target.value))}}><option value={10}>10 条</option><option value={20}>20 条</option><option value={50}>50 条</option></select></label><button disabled={page===1} onClick={()=>setPage(page-1)}>上一页</button><span>第 {page} / {Math.max(1,Math.ceil(total/limit))} 页</span><button disabled={page*limit>=total} onClick={()=>setPage(page+1)}>下一页</button></div>
  </section>
  {actionModal&&<div className="history-modal-overlay"><div className="history-action-modal" role="dialog" aria-modal="true" aria-labelledby="history-modal-title" aria-describedby={actionModal.message?'history-modal-message':undefined}><h2 id="history-modal-title">{actionModal.title}</h2>{actionModal.message&&<p id="history-modal-message">{actionModal.message}</p>}<div className="history-modal-actions">{actionModal.stage==='confirm'?<><button type="button" ref={modalButton} onClick={()=>setActionModal(null)} disabled={acting}>取消</button><button type="button" className="confirm" onClick={()=>void confirmAction()} disabled={acting}>{acting?'处理中…':'确认'}</button></>:<button type="button" ref={modalButton} className="confirm" onClick={()=>setActionModal(null)}>确认</button>}</div></div></div>}
 </main>;
}
