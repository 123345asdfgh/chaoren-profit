'use client';

import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Check,FileSpreadsheet,Link,LogOut,Plus,RefreshCw,UserRound,X} from 'lucide-react';
import './feishu.css';

type Status={installed:boolean;connected:boolean;displayName?:string;reason?:string;busy?:boolean;pending?:{phase:string;authorizationUrl?:string;reason?:string;expiresAt:number}};
type Table={id:string;name:string};
type SavedTable=Table&{url:string;tableId:string;documentName:string;sourceType:'primary'|'secondary';updatedAt:string};
type Data={name:string;columns:string[];rows:unknown[][];complete:boolean;warning?:string};
async function api<T>(endpoint:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 const response=await fetch('/api/profit/feishu/'+endpoint,{method:body===undefined?'GET':'POST',...(body===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)}),cache:'no-store',signal});
 const value=await response.json();if(!response.ok)throw new Error(value.error||'操作失败，请重试。');return value;
}
function cell(value:unknown):string{
 if(value===null||value===undefined)return '—';
 if(typeof value==='boolean')return value?'是':'否';
 if(Array.isArray(value))return value.map(cell).join('、');
 if(typeof value==='object'){
  const data=value as Record<string,unknown>;
  if(typeof data.text==='string')return data.text;
  if(typeof data.name==='string')return data.name;
  return JSON.stringify(value);
 }
 return String(value);
}

export default function FeishuPage(){
 const [status,setStatus]=useState<Status>();const [error,setError]=useState('');const [working,setWorking]=useState('');
 const [url,setUrl]=useState('');const [tables,setTables]=useState<Table[]>([]);const [tableId,setTableId]=useState('');
 const [savedTables,setSavedTables]=useState<SavedTable[]>([]);const [savedId,setSavedId]=useState('');
 const [adding,setAdding]=useState(false);const [savedLoaded,setSavedLoaded]=useState(false);const [notice,setNotice]=useState('');
 const [data,setData]=useState<Data>();const [page,setPage]=useState(1);const [pageSize,setPageSize]=useState(20);
 const confirmRef=useRef<HTMLDialogElement>(null);
 const loginRef=useRef<HTMLDialogElement>(null);const [loginOpen,setLoginOpen]=useState(false);
 const pending=status?.pending;const authorizing=!!pending&&['configuring','authorizing'].includes(pending.phase);
 const selectedTable=savedTables.find(table=>table.id===savedId);

 useEffect(()=>{const controller=new AbortController();api<Status>('status',undefined,controller.signal).then(setStatus).catch(err=>{if(!controller.signal.aborted)setError(err.message)});return()=>controller.abort()},[]);
 // Wait for status to establish the standalone identity cookie before loading
 // bookmarks. Parallel first requests could otherwise create different owners.
 useEffect(()=>{
  if(!status||savedLoaded)return;
  const controller=new AbortController();
  api<{tables:SavedTable[]}>('saved-tables',undefined,controller.signal).then(result=>{
   setSavedTables(result.tables);setSavedId(result.tables[0]?.id||'');setAdding(result.tables.length===0);setSavedLoaded(true);
  }).catch(err=>{if(!controller.signal.aborted){setError(err.message);setSavedLoaded(true)}});
  return()=>controller.abort();
 },[!!status,savedLoaded]);
 useEffect(()=>{
  if(!authorizing)return;
  let active=true;let timer:ReturnType<typeof setTimeout>;const controller=new AbortController();
  const poll=async()=>{try{const result=await api<Status>('status',undefined,controller.signal);if(active){setStatus(result);setError('');if(result.pending&&['configuring','authorizing'].includes(result.pending.phase))timer=setTimeout(poll,2000)}}catch(err){if(active){setError(err instanceof Error?err.message:'无法刷新登录状态。');timer=setTimeout(poll,4000)}}};
  timer=setTimeout(poll,1000);return()=>{active=false;clearTimeout(timer);controller.abort()};
 },[authorizing]);
 useEffect(()=>{if(status?.connected)loginRef.current?.close()},[status?.connected]);

 async function connect(){
  setLoginOpen(true);loginRef.current?.showModal();
  if(authorizing)return;
  setWorking('login');setError('');
  setStatus(current=>current?{...current,pending:undefined}:current);
  try{setStatus(await api<Status>('login',{}))}catch(err){setError((err as Error).message)}finally{setWorking('')}
 }
 async function refresh(){setWorking('status');setError('');try{setStatus(await api<Status>('status'))}catch(err){setError((err as Error).message)}finally{setWorking('')}}
 async function disconnect(){
  setWorking('disconnect');setError('');
  try{await api('disconnect',{});setStatus(await api<Status>('status'));setData(undefined);setTables([]);setTableId('');setNotice('');loginRef.current?.close()}catch(err){setError((err as Error).message)}finally{setWorking('')}
 }
 async function discover(event:React.FormEvent){
  event.preventDefault();setWorking('tables');setError('');setNotice('');setTables([]);setTableId('');setData(undefined);
  try{const result=await api<{tables:Table[];selected:string}>('tables',{url});setTables(result.tables);setTableId(result.selected);if(!result.tables.length)setError('这份表格中没有可读取的工作表。')}catch(err){setError((err as Error).message)}finally{setWorking('')}
 }
 async function saveTable(){
  setWorking('save');setError('');setNotice('');
  try{
   const result=await api<SavedTable>('saved-tables',{url,tableId});
   setSavedTables(current=>[result,...current.filter(item=>item.id!==result.id)]);setSavedId(result.id);
   setAdding(false);setUrl('');setTables([]);setTableId('');setData(undefined);setNotice('表格已保存，下次可直接从列表选择并读取。');
  }catch(err){setError((err as Error).message)}finally{setWorking('')}
 }
 async function read(){
  setWorking('read');setError('');setData(undefined);
  try{setData(await api<Data>('saved-tables/'+encodeURIComponent(savedId)+'/read',{}));setPage(1)}catch(err){setError((err as Error).message)}finally{setWorking('')}
 }
 const totalPages=Math.max(1,Math.ceil((data?.rows.length||0)/pageSize));
 return <main className={'feishu-page'+(!status?.connected?' feishu-page-signed-out':'')}>
  <header className="feishu-header"><div><h1>飞书连接</h1><p>连接飞书账号，读取指定表格的数据。</p></div>
   <div className="feishu-header-actions">
    <div className="feishu-user" title={status?.connected?(status.displayName||'飞书账号已连接'):'未登录'}>
     <span className={'feishu-avatar'+(status?.connected?' connected':'')} role="img" aria-label={status?.connected?'当前用户头像':'未登录用户头像'}>{status?.connected&&status.displayName?status.displayName.slice(0,1):<UserRound size={19} aria-hidden="true"/>}</span>
     <button className="feishu-refresh" onClick={refresh} disabled={!!working}><RefreshCw size={14} className={working==='status'?'feishu-spinning':''} aria-hidden="true"/>{working==='status'?'刷新中…':'刷新状态'}</button>
     {status?.connected&&<span className="feishu-user-name">{status.displayName||'已连接'}</span>}
     {status?.connected&&<button onClick={()=>confirmRef.current?.showModal()} disabled={!!working}><LogOut size={15} aria-hidden="true"/>退出登录</button>}
    </div>
   </div>
  </header>
  {!status?.connected&&<div className="feishu-login-stage"><section className="feishu-card feishu-login-card" aria-labelledby="feishu-account-title">
   <div className="feishu-login-symbol" aria-hidden="true"><Link size={30}/></div>
   <h2 id="feishu-account-title">连接飞书账号</h2>
   <p>登录后即可选择已保存的表格，或添加新的表格链接。</p>
   <span className="feishu-status" role="status">{!status?'检查连接中':authorizing?'等待授权':'未连接'}</span>
   <button className="feishu-primary" onClick={connect} disabled={!status?.installed||!!working}>{working==='login'?'正在准备…':authorizing?'继续授权':'登录飞书'}</button>
   {!status?.installed&&status?.reason&&<p className="feishu-error" role="alert">{status.reason}</p>}
   {!loginOpen&&!authorizing&&pending?.reason&&<p className="feishu-error" role="alert">{pending.reason}</p>}
   {!loginOpen&&error&&<p className="feishu-error" role="alert">{error}</p>}
  </section></div>}

  {status?.connected&&<section className="feishu-card feishu-workspace" aria-labelledby="feishu-table-title">
   <div className="feishu-workspace-heading"><div className="feishu-heading-title"><span className="feishu-section-icon"><FileSpreadsheet size={20} aria-hidden="true"/></span><h2 id="feishu-table-title">我的表格</h2><span className="feishu-table-count">{savedTables.length}</span></div><button className={'feishu-add-toggle'+(adding?' active':'')} aria-expanded={adding} aria-controls="feishu-table-panel" onClick={()=>{setAdding(value=>!value);setError('');setNotice('')}} disabled={!savedLoaded||!!working}>{adding?<X size={15} aria-hidden="true"/>:<Plus size={15} aria-hidden="true"/>}{adding?'取消添加':'添加表格'}</button></div>
   <div className="feishu-workspace-body">
    <aside className="feishu-library" aria-label="已保存的表格">
     <div className="feishu-library-label">已保存的表格</div>
     <div className="feishu-library-list">
      {!savedLoaded?<p className="feishu-library-empty">正在加载表格…</p>:!savedTables.length?<p className="feishu-library-empty">暂无表格，点击右上角添加。</p>:savedTables.map(table=><button className={'feishu-library-item'+(savedId===table.id?' selected':'')} key={table.id} aria-pressed={savedId===table.id} disabled={!!working} onClick={()=>{setSavedId(table.id);setAdding(false);setData(undefined);setError('');setNotice('')}}>
       <span className={'feishu-file-icon '+table.sourceType}><FileSpreadsheet size={20} aria-hidden="true"/></span>
       <span className="feishu-library-text"><strong>{table.documentName||table.name}</strong><span>{table.documentName?table.name:'飞书表格'}</span><small className={'feishu-type-tag '+table.sourceType}>{table.sourceType==='primary'?'一类 · 寄样记录':'二类 · 履约跟进'}</small></span>
       <span className="feishu-library-check" aria-hidden="true">{savedId===table.id?<Check size={15}/>:<ArrowRight size={14}/>}</span>
      </button>)}
     </div>
    </aside>
    <div className="feishu-table-panel" id="feishu-table-panel">
     {adding?<div className="feishu-add-panel">
      <div className="feishu-panel-title"><h3>添加表格</h3><span className="feishu-type-tag secondary">二类表</span></div>
      <p className="feishu-panel-description">添加达人跟进与履约表，保存后可直接从左侧选择。</p>
      <form className="feishu-source" onSubmit={discover}>
       <label htmlFor="feishu-table-url">飞书表格链接<input id="feishu-table-url" type="url" required value={url} onChange={event=>{setUrl(event.target.value);setTables([]);setTableId('');setError('');setNotice('')}} placeholder="粘贴飞书表格链接" disabled={!!working}/></label>
       <button type="submit" disabled={!!working||!url.trim()}>{working==='tables'?'正在获取…':'获取数据表'}<ArrowRight size={15} aria-hidden="true"/></button>
      </form>
      <p className="feishu-add-note">支持多维表格、电子表格及知识库表格；月份自动从文件名或表内日期识别。</p>
      {tables.length>0&&<div className="feishu-selection"><label>选择数据表<select value={tableId} onChange={event=>{setTableId(event.target.value);setError('')}} disabled={!!working}><option value="">请选择数据表</option>{tables.map(table=><option key={table.id} value={table.id}>{table.name}</option>)}</select></label><button className="feishu-primary" onClick={saveTable} disabled={!tableId||!!working}>{working==='save'?'正在保存…':'保存表格'}</button></div>}
     </div>:selectedTable?<div className="feishu-read-panel">
      <div className="feishu-panel-title"><h3>读取表格</h3><span className={'feishu-type-tag '+selectedTable.sourceType}>{selectedTable.sourceType==='primary'?'一类表':'二类表'}</span></div>
      <h4>{selectedTable.documentName||selectedTable.name}</h4>
      <div className="feishu-table-meta"><span>数据表</span><strong>{selectedTable.name}</strong></div>
      <div className="feishu-table-meta"><span>来源</span><span>{new URL(selectedTable.url).hostname}</span></div>
      <div className="feishu-read-actions"><button className="feishu-primary" onClick={read} disabled={!savedId||!!working}><FileSpreadsheet size={16} aria-hidden="true"/>{working==='read'?'正在读取…':'读取表格'}<ArrowRight size={16} aria-hidden="true"/></button><span role="status">{working==='read'?'正在逐页读取，请稍候。':'读取最新数据'}</span></div>
     </div>:<div className="feishu-panel-empty"><FileSpreadsheet size={34} aria-hidden="true"/><h3>选择一张表格</h3><p>从左侧选择已保存的表格，或添加新的链接。</p></div>}
     {notice&&<p className="feishu-success" role="status"><Check size={15} aria-hidden="true"/>{notice}</p>}
    </div>
   </div>
  </section>}
  {status?.connected&&error&&!loginOpen&&<p className="feishu-error feishu-page-error" role="alert">{error}</p>}

  {status?.connected&&data&&<section className="feishu-card feishu-results" aria-labelledby="feishu-result-title">
   <div className="feishu-card-heading"><div><h2 id="feishu-result-title">{selectedTable?.documentName?selectedTable.documentName+' / ':''}{selectedTable?.name||data.name}</h2><p>{data.complete?'已完整读取':'已读取部分数据'} {data.rows.length.toLocaleString()} 条 · {data.columns.length} 列</p></div></div>
   {data.warning&&<p className="feishu-error" role="alert">{data.warning}</p>}
   {data.columns.length>0?<div className="feishu-table-scroll"><table><thead><tr><th scope="col">序号</th>{data.columns.map((column,index)=><th scope="col" key={index}>{column||'未命名字段'}</th>)}</tr></thead><tbody>{data.rows.slice((page-1)*pageSize,page*pageSize).map((row,index)=><tr key={(page-1)*pageSize+index}><td>{(page-1)*pageSize+index+1}</td>{data.columns.map((_,column)=><td key={column}>{cell(row[column])}</td>)}</tr>)}</tbody></table></div>:null}
   {!data.rows.length&&<p className="feishu-empty">此表暂无数据。</p>}
   <div className="feishu-pagination"><label>每页显示 <select value={pageSize} onChange={event=>{setPageSize(Number(event.target.value));setPage(1)}}>{[10,20,50].map(size=><option key={size} value={size}>{size} 条</option>)}</select></label><div><button disabled={page===1} onClick={()=>setPage(page-1)}>上一页</button><span>第 {page} / {totalPages} 页</span><button disabled={page>=totalPages} onClick={()=>setPage(page+1)}>下一页</button></div></div>
  </section>}
  <dialog ref={loginRef} className="feishu-login-dialog" aria-labelledby="feishu-login-title" onClose={()=>setLoginOpen(false)}>
   <div className="feishu-dialog-heading"><div><h2 id="feishu-login-title">连接飞书账号</h2></div><button className="feishu-dialog-close" aria-label="关闭登录弹窗" onClick={()=>loginRef.current?.close()}><X size={19} aria-hidden="true"/></button></div>
   <ol className="feishu-login-steps" aria-label="飞书登录步骤">
    <li className={'feishu-login-step '+(pending?.phase==='authorizing'?'completed':'active')} aria-current={pending?.phase!=='authorizing'?'step':undefined}><span className="feishu-step-number">{pending?.phase==='authorizing'?<Check size={16} aria-hidden="true"/>:'1'}</span><div><small>第一步</small><strong>配置飞书应用</strong></div></li>
    <li className="feishu-step-arrow" aria-hidden="true"><ArrowRight size={23}/></li>
    <li className={'feishu-login-step '+(pending?.phase==='authorizing'?'active':'')} aria-current={pending?.phase==='authorizing'?'step':undefined}><span className="feishu-step-number">2</span><div><small>第二步</small><strong>登录并授权</strong></div></li>
   </ol>
   <div className="feishu-authorization">
    <div><h3>{pending?.phase==='authorizing'?'登录并授权表格读取':'配置飞书应用'}</h3><p>{authorizing?(pending?.authorizationUrl?'扫码或打开链接完成授权。':'正在生成官方授权链接…'):working==='login'?'正在准备登录…':'请重新连接以继续授权。'}</p>
     {authorizing&&pending?.authorizationUrl&&<a className="feishu-auth-link" href={pending.authorizationUrl} target="_blank" rel="noopener noreferrer">打开飞书授权页面 ↗</a>}
    </div>
    {authorizing&&pending?.authorizationUrl&&<img key={pending.authorizationUrl} className="feishu-qrcode" src={'/api/profit/feishu/qrcode?v='+encodeURIComponent(pending.phase)} width="156" height="156" alt="飞书官方授权二维码"/>}
   </div>
   {!authorizing&&pending?.reason&&<p className="feishu-error" role="alert">{pending.reason}</p>}
   {error&&<p className="feishu-error" role="alert">{error}</p>}
   <div className="feishu-dialog-footer">{authorizing?<><button onClick={()=>confirmRef.current?.showModal()} disabled={!!working}>取消登录</button><button className="feishu-primary" onClick={()=>loginRef.current?.close()}>稍后继续</button></>:<button className="feishu-primary" onClick={connect} disabled={!!working||!status?.installed}>{working==='login'?'正在准备…':'重新连接'}</button>}</div>
  </dialog>
  <dialog ref={confirmRef} className="feishu-confirm"><h2>{authorizing?'取消飞书登录':'退出飞书连接'}</h2><p>{authorizing?'确认取消本次授权？':'退出后，读取表格需要重新登录。'}</p><form method="dialog"><button value="cancel">返回</button><button className="feishu-primary" value="confirm" onClick={()=>{void disconnect()}}>确认</button></form></dialog>
 </main>;
}
