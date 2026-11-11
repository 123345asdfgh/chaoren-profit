'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import '../shared.css';

type RecordItem={id:string;name:string;category:string;specCode:string;productCode:string;operatorName:string|null;version:number;previousVersion:number|null;netRmb:number;netUsd:number;margin:number|null;savedAt:string;previousSnapshot:unknown;snapshot:{fields:Record<string,string>}};
type ActionModal={stage:'confirm'|'result';kind:'restore'|'delete';row:RecordItem;title:string;message:string};
const baseCategories=['普货','潮玩','带电','带磁','毛绒','洞洞包','包袋','液体','未分类'];
const money=(n:number,unit='RMB')=>new Intl.NumberFormat('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+' '+unit;
const recordFields:[string,string][]=[['chinaPrice','中国组合价（RMB）'],['salePrice','美区商品售价（USD）'],['buyerShipping','买家运费（USD）'],['receipt','最终含税实收（USD）'],['logistics','实际物流成本'],['currency','物流成本币种']];
const configFields:[string,string][]=[['fx','结算汇率（RMB/USD）'],['multiplier','参考售价倍率'],['costRate','产品成本比例（%）'],['divisor','去税除数'],['tax','所得税率（%）'],['promotion','推广费（%）'],['operation','代运营（%）'],['platform','平台佣金（%）'],['royalty','版权费（%）'],['labor','人工成本（%）'],['other','其他费用（%）']];

export default function History(){
 const [query,setQuery]=useState(''),[specCode,setSpecCode]=useState(''),[productCode,setProductCode]=useState(''),[categories,setCategories]=useState<string[]>([]),[availableCategories,setAvailableCategories]=useState(baseCategories),[operator,setOperator]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[page,setPage]=useState(1),[limit,setLimit]=useState(10);
 const [records,setRecords]=useState<RecordItem[]>([]),[total,setTotal]=useState(0),[message,setMessage]=useState(''),[loading,setLoading]=useState(true),[exporting,setExporting]=useState(false),[actionModal,setActionModal]=useState<ActionModal|null>(null),[detailRecord,setDetailRecord]=useState<RecordItem|null>(null),[acting,setActing]=useState(false);
 const requestSerial=useRef(0);
 const modalButton=useRef<HTMLButtonElement>(null);
 const detailButton=useRef<HTMLButtonElement>(null);
 const filterParams=useCallback(()=>{const params=new URLSearchParams({q:query,specCode,productCode,operator});for(const category of categories)params.append('category',category);if(from)params.set('from',from);if(to)params.set('to',to);return params},[query,specCode,productCode,categories,operator,from,to]);
 const refresh=useCallback(async()=>{
  const serial=++requestSerial.current;setLoading(true);
  try{const params=filterParams();params.set('page',String(page));params.set('limit',String(limit));const response=await fetch('/api/profit/records?'+params);const data=await response.json();if(serial!==requestSerial.current)return;if(!response.ok)throw Error(data.error||'加载失败');if(page>1&&data.total<=(page-1)*limit){setPage(Math.max(1,Math.ceil(data.total/limit)));return}setRecords(data.records);setTotal(data.total);setMessage('')}
  catch(error){if(serial===requestSerial.current)setMessage((error as Error).message)}finally{if(serial===requestSerial.current)setLoading(false)}
 },[filterParams,page,limit]);
 useEffect(()=>{void refresh()},[refresh]);
 useEffect(()=>{fetch('/api/profit/categories').then(async response=>{if(response.ok){const data=await response.json();setAvailableCategories(Array.from(new Set([...baseCategories,...data.categories])))}}).catch(()=>{})},[]);
 useEffect(()=>{if(!actionModal)return;modalButton.current?.focus();const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!acting)setActionModal(null)};window.addEventListener('keydown',onKeyDown);return()=>window.removeEventListener('keydown',onKeyDown)},[actionModal,acting]);
 useEffect(()=>{if(!detailRecord)return;detailButton.current?.focus();const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setDetailRecord(null)};window.addEventListener('keydown',onKeyDown);return()=>window.removeEventListener('keydown',onKeyDown)},[detailRecord]);
 function openAction(row:RecordItem,kind:'restore'|'delete'){
  setDetailRecord(null);setActionModal({stage:'confirm',kind,row,title:kind==='restore'?'恢复上一版':'删除记录',message:kind==='restore'?`将“${row.name}”恢复为第 ${row.previousVersion} 版。当前第 ${row.version} 版仍可切换回来。`:`将删除“${row.name}”及其可恢复版本，此操作不可撤销。`});
 }
 async function confirmAction(){
  if(!actionModal||actionModal.stage!=='confirm')return;
  const {row,kind}=actionModal;setActing(true);
  try{const response=await fetch('/api/profit/records/'+row.id+(kind==='restore'?'/restore':''),{method:kind==='restore'?'POST':'DELETE'});const data=await response.json();if(!response.ok)throw Error(data.error||'操作失败');await refresh();setActionModal({stage:'result',kind,row,title:kind==='restore'?'恢复成功':'删除成功',message:kind==='restore'?`“${row.name}”当前已恢复为第 ${data.version} 版。`:`“${row.name}”已从历史记录中删除。`})}
  catch(error){setActionModal({stage:'result',kind,row,title:'操作未完成',message:(error as Error).message})}
  finally{setActing(false)}
 }
 async function exportCsv(){setExporting(true);try{const response=await fetch('/api/profit/records/export?'+filterParams());if(!response.ok){const data=await response.json();throw Error(data.error||'导出失败')}const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='历史测算.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('已导出当前筛选范围内的全部记录。')}
  catch(error){setMessage((error as Error).message)}finally{setExporting(false)}}
 const filter=(setter:(value:string)=>void)=>(event:React.ChangeEvent<HTMLInputElement>)=>{setPage(1);setter(event.target.value)};
 const toggleCategory=(category:string)=>{setPage(1);setCategories(current=>current.includes(category)?current.filter(value=>value!==category):[...current,category])};
 const hasFilter=Boolean(query||specCode||productCode||categories.length||operator||from||to);
 return <main className="history-page">
  <header className="history-top"><div className="history-brand"><Image src="/legacy/assets/chaoren-logo.webp" width={131} height={75} alt="CHAOREN AI"/><div><small>US TiKTOK shop</small><h1>历史测算记录</h1></div></div><nav><Link href="/calculator">返回利润计算</Link></nav></header>
  <section className="filters">
   <label>商品名称<input value={query} onChange={filter(setQuery)} placeholder="商品名称"/></label>
   <label>商品编码<input value={productCode} onChange={filter(setProductCode)} placeholder="商品编码"/></label>
   <label>规格编码<input value={specCode} onChange={filter(setSpecCode)} placeholder="规格编码"/></label>
   <div className="category-filter"><span>商品属性</span><details><summary>{categories.length?`已选 ${categories.length} 项`:'全部属性'}</summary><div className="category-options">{availableCategories.map(category=><label key={category}><input type="checkbox" checked={categories.includes(category)} onChange={()=>toggleCategory(category)}/>{category}</label>)}</div></details></div>
   <label>操作人<input value={operator} onChange={filter(setOperator)} placeholder="姓名"/></label>
   <label>开始日期<input type="date" value={from} onChange={filter(setFrom)}/></label>
   <label>结束日期<input type="date" value={to} onChange={filter(setTo)}/></label>
  </section>
  <section className="record-list">
   <div className="list-head"><h2>测算记录 <small>共 {total} 条</small></h2><div className="history-list-tools"><button type="button" disabled={loading||exporting||total===0} onClick={()=>void exportCsv()}>{exporting?'导出中…':'导出 CSV'}</button>{loading&&<span>加载中…</span>}</div></div>
   {message&&<p role="status" className="feedback">{message}</p>}
   {!loading&&!message&&records.length===0&&<p>{hasFilter?'没有符合条件的记录。':'暂无历史记录。'}</p>}
   {!loading&&records.map(row=><article key={row.id} className="record-row"><div><strong>{row.name}</strong><span className="tag">{row.category}</span><p>规格编码 {row.specCode} · 商品编码 {row.productCode}</p><small>{new Date(row.savedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})} · {row.operatorName||'未记录操作人'} · 第 {row.version} 版</small></div><div className="record-actions"><button onClick={()=>setDetailRecord(row)}>查看详情</button><button disabled={!row.previousSnapshot} onClick={()=>openAction(row,'restore')}>{row.previousSnapshot?`恢复第 ${row.previousVersion} 版`:'恢复上一版'}</button><button className="danger" onClick={()=>openAction(row,'delete')}>删除</button></div></article>)}
   <div className="pagination"><label>每页显示 <select value={limit} onChange={event=>{setPage(1);setLimit(Number(event.target.value))}}><option value={10}>10 条</option><option value={20}>20 条</option><option value={50}>50 条</option></select></label><button disabled={page===1} onClick={()=>setPage(page-1)}>上一页</button><span>第 {page} / {Math.max(1,Math.ceil(total/limit))} 页</span><button disabled={page*limit>=total} onClick={()=>setPage(page+1)}>下一页</button></div>
  </section>
  {detailRecord&&<div className="history-modal-overlay" onClick={event=>{if(event.target===event.currentTarget)setDetailRecord(null)}}><div className="history-action-modal history-detail-modal" role="dialog" aria-modal="true" aria-labelledby="history-detail-title"><div className="history-detail-heading"><div><small>第 {detailRecord.version} 版 · {new Date(detailRecord.savedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</small><h2 id="history-detail-title">{detailRecord.name}</h2><p>{detailRecord.category} · 规格编码 {detailRecord.specCode} · 商品编码 {detailRecord.productCode}</p></div><button type="button" ref={detailButton} onClick={()=>setDetailRecord(null)} aria-label="关闭详情">关闭 ✕</button></div><div className="history-detail-profit"><div><span>人民币净利润</span><strong>{money(detailRecord.netRmb)}</strong></div><div><span>美元净利润</span><strong>{money(detailRecord.netUsd,'USD')}</strong></div><div><span>净利润率</span><strong>{detailRecord.margin===null?'不适用':(detailRecord.margin*100).toFixed(2)+'%'}</strong></div></div><h3>测算输入</h3><dl className="history-detail-grid">{recordFields.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{detailRecord.snapshot.fields[key]??'—'}</dd></div>)}</dl><h3>本版计算配置</h3><dl className="history-detail-grid">{configFields.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{detailRecord.snapshot.fields[key]??'—'}</dd></div>)}</dl><div className="history-modal-actions"><button type="button" onClick={()=>setDetailRecord(null)}>返回列表</button><Link className="confirm" href={'/calculator?record='+encodeURIComponent(detailRecord.id)}>载入并修改</Link></div></div></div>}
  {actionModal&&<div className="history-modal-overlay"><div className="history-action-modal" role="dialog" aria-modal="true" aria-labelledby="history-modal-title" aria-describedby="history-modal-message"><h2 id="history-modal-title">{actionModal.title}</h2><p id="history-modal-message">{actionModal.message}</p><div className="history-modal-actions">{actionModal.stage==='confirm'?<><button type="button" ref={modalButton} onClick={()=>setActionModal(null)} disabled={acting}>取消</button><button type="button" className="confirm" onClick={()=>void confirmAction()} disabled={acting}>{acting?'处理中…':'确认'}</button></>:<button type="button" ref={modalButton} className="confirm" onClick={()=>setActionModal(null)}>确认</button>}</div></div></div>}
 </main>
}
