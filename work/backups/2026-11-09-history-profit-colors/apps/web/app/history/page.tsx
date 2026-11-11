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
type ActionModal={stage:'confirm'|'result';kind:'restore'|'delete';row:RecordItem;title:string;message:string};
const money=(value:number|null)=>value===null?'—':'¥'+value.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
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
 const requestSerial=useRef(0);
 const modalButton=useRef<HTMLButtonElement>(null);
 const filterParams=useCallback(()=>{const params=new URLSearchParams({q:query,operator});for(const category of categories)params.append('category',category);if(from)params.set('from',from);if(to)params.set('to',to);return params},[query,categories,operator,from,to]);
 const listParams=filterParams();listParams.set('page',String(page));listParams.set('limit',String(limit));
 for(const key of ['q','operator'])if(!listParams.get(key))listParams.delete(key);
 const listHref='/history?'+listParams.toString();
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  setQuery(params.get('q')||'');setOperator(params.get('operator')||'');setCategories(params.getAll('category').filter(Boolean));
  for(const [key,setter]of [['from',setFrom],['to',setTo]] as const){const value=params.get(key)||'';setter(/^\d{4}-\d{2}-\d{2}$/.test(value)?value:'')}
  const requestedPage=Number(params.get('page')),requestedLimit=Number(params.get('limit'));
  setPage(Number.isSafeInteger(requestedPage)&&requestedPage>0?requestedPage:1);setLimit([10,20,50].includes(requestedLimit)?requestedLimit:10);setFiltersReady(true);
 },[]);
 useEffect(()=>{if(filtersReady)window.history.replaceState(window.history.state,'',listHref)},[filtersReady,listHref]);
 const refresh=useCallback(async()=>{const serial=++requestSerial.current;setLoading(true);try{const params=filterParams();params.set('page',String(page));params.set('limit',String(limit));const response=await fetch('/api/profit/records?'+params);const data=await response.json();if(serial!==requestSerial.current)return;if(!response.ok)throw Error(data.error||'加载失败');if(page>1&&data.total<=(page-1)*limit){setPage(Math.max(1,Math.ceil(data.total/limit)));return}setRecords(data.records);setTotal(data.total);setMessage('')}catch(error){if(serial===requestSerial.current)setMessage((error as Error).message)}finally{if(serial===requestSerial.current)setLoading(false)}},[filterParams,page,limit]);
 useEffect(()=>{if(filtersReady)void refresh()},[refresh,filtersReady]);
 useEffect(()=>{fetch('/api/profit/categories').then(async response=>{if(response.ok){const data=await response.json();setAvailableCategories(Array.from(new Set([...baseCategories,...data.categories])))}}).catch(()=>{})},[]);
 useEffect(()=>{if(!actionModal)return;modalButton.current?.focus();const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!acting)setActionModal(null)};window.addEventListener('keydown',onKeyDown);return()=>window.removeEventListener('keydown',onKeyDown)},[actionModal,acting]);
 function openAction(row:RecordItem,kind:'restore'|'delete'){setActionModal({stage:'confirm',kind,row,title:kind==='restore'?'恢复上一版':'删除记录',message:kind==='restore'?`将“${row.name||row.specCode}”恢复为第 ${row.previousVersion} 版，其他版本保留。`:`“${row.name||row.specCode}”及全部历史版本将被删除，无法恢复。`})}
 async function confirmAction(){if(!actionModal||actionModal.stage!=='confirm')return;const {row,kind}=actionModal;setActing(true);try{const response=await fetch('/api/profit/records/'+row.id+(kind==='restore'?'/restore':''),{method:kind==='restore'?'POST':'DELETE'});const data=await response.json();if(!response.ok)throw Error(data.error||'操作失败');await refresh();setActionModal({stage:'result',kind,row,title:kind==='restore'?'恢复成功':'删除成功',message:kind==='restore'?`当前第 ${data.version} 版。`:''})}catch(error){setActionModal({stage:'result',kind,row,title:'操作未完成',message:(error as Error).message})}finally{setActing(false)}}
 async function exportExcel(){setExporting(true);try{const response=await fetch('/api/profit/records/export?'+filterParams());if(!response.ok){const data=await response.json();throw Error(data.error||'导出失败')}const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='历史测算.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('已导出当前筛选范围内的全部记录。')}catch(error){setMessage((error as Error).message)}finally{setExporting(false)}}
 const filter=(setter:(value:string)=>void)=>(event:React.ChangeEvent<HTMLInputElement>)=>{setPage(1);setter(event.target.value)};
 const toggleCategory=(category:string)=>{setPage(1);setCategories(current=>current.includes(category)?current.filter(value=>value!==category):[...current,category])};
 const hasFilter=Boolean(query||categories.length||operator||from||to);
 return <main className="history-page">
  <header className="history-top"><div className="history-brand"><Image src="/legacy/assets/chaoren-logo.webp" width={131} height={75} alt="CHAOREN AI"/><div><small>US TiKTOK shop</small><h1>历史测算记录</h1></div></div><nav><Link className="history-new-product" href={withHistoryReturn('/calculator',listHref)}>＋ 新增商品</Link></nav></header>
  <TimeDisplay/>
  <section className="filters">
   <label className="history-search-field">商品名称 / 规格编码 / 商品编码<input value={query} onChange={filter(setQuery)} placeholder="搜索商品名称、规格编码或商品编码"/></label>
   <label>操作人<input value={operator} onChange={filter(setOperator)} placeholder="姓名"/></label>
   <div className="category-filter"><span>商品属性</span><details><summary>{categories.length?`已选 ${categories.length} 项`:'全部属性'}</summary><div className="category-options">{availableCategories.map(category=><label key={category}><input type="checkbox" checked={categories.includes(category)} onChange={()=>toggleCategory(category)}/>{category}</label>)}</div></details></div>
   <label>开始日期<input type="date" value={from} onChange={filter(setFrom)}/></label><label>结束日期<input type="date" value={to} onChange={filter(setTo)}/></label>
  </section>
  <section className="record-list">
   <div className="list-head"><h2>测算记录 <small>共 {total} 条</small></h2><div className="history-list-tools"><button type="button" disabled={loading||exporting||total===0} onClick={()=>void exportExcel()}>{exporting?'导出中…':'导出 Excel'}</button>{loading&&<span>加载中…</span>}</div></div>
   {message&&<p role="status" className="feedback">{message}</p>}
   {!loading&&!message&&records.length===0&&<p>{hasFilter?'没有符合条件的记录。':'暂无历史记录。'}</p>}
   {!loading&&records.length>0&&<div className="history-record-table-wrap"><table className="history-record-table"><thead><tr><th>商品图片</th><th>商品名称</th><th>规格编码</th><th>商品编码</th><th>商品属性</th><th>净利润</th><th>利润率</th><th>最近保存</th><th>操作人</th><th>操作</th></tr></thead><tbody>{records.map(row=>{const photoId=row.snapshot.fields.photoId;return <tr key={row.id}>
    <td>{photoId&&/^[0-9a-f-]{36}$/i.test(photoId)?<Image className="history-record-photo" unoptimized src={'/api/profit/product-photos/'+photoId} width={52} height={52} alt={row.name||'商品图片'}/>:<div className="history-record-photo history-record-photo-empty" aria-label="暂无商品图片"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg></div>}</td>
    <td className="history-record-name"><strong>{row.name||'—'}</strong><small>第 {row.version} 版</small></td><td>{row.specCode}</td><td>{row.productCode||'—'}</td><td>{row.category||'—'}</td><td className="history-record-amount">{money(row.netRmb)}</td><td>{row.margin===null?'—':(row.margin*100).toFixed(2)+'%'}</td><td>{new Date(row.savedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</td><td>{row.operatorName||'未记录'}</td>
    <td><div className="record-actions"><Link href={withHistoryReturn(`/history/product/${row.id}`,listHref)}>查看详情</Link><Link href={withHistoryReturn(`/calculator?record=${encodeURIComponent(row.id)}`,listHref)}>新增测算</Link><button disabled={!row.previousSnapshot} onClick={()=>openAction(row,'restore')}>{row.previousSnapshot?`恢复第 ${row.previousVersion} 版`:'恢复上一版'}</button><button className="danger" onClick={()=>openAction(row,'delete')}>删除</button></div></td>
   </tr>})}</tbody></table></div>}
   <div className="pagination"><label>每页显示 <select value={limit} onChange={event=>{setPage(1);setLimit(Number(event.target.value))}}><option value={10}>10 条</option><option value={20}>20 条</option><option value={50}>50 条</option></select></label><button disabled={page===1} onClick={()=>setPage(page-1)}>上一页</button><span>第 {page} / {Math.max(1,Math.ceil(total/limit))} 页</span><button disabled={page*limit>=total} onClick={()=>setPage(page+1)}>下一页</button></div>
  </section>
  {actionModal&&<div className="history-modal-overlay"><div className="history-action-modal" role="dialog" aria-modal="true" aria-labelledby="history-modal-title" aria-describedby={actionModal.message?'history-modal-message':undefined}><h2 id="history-modal-title">{actionModal.title}</h2>{actionModal.message&&<p id="history-modal-message">{actionModal.message}</p>}<div className="history-modal-actions">{actionModal.stage==='confirm'?<><button type="button" ref={modalButton} onClick={()=>setActionModal(null)} disabled={acting}>取消</button><button type="button" className="confirm" onClick={()=>void confirmAction()} disabled={acting}>{acting?'处理中…':'确认'}</button></>:<button type="button" ref={modalButton} className="confirm" onClick={()=>setActionModal(null)}>确认</button>}</div></div></div>}
 </main>;
}
