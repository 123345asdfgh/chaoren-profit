'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {useParams} from 'next/navigation';
import '../../history-product.css';
import TimeDisplay from '../../../shared-time';
import ExportExcel from '../../export-excel';
import {useHistoryReturn,withHistoryReturn} from '../../return-navigation';

type HistoryRecord={id:string;isCurrent?:boolean;name:string;category:string;specCode:string;productCode:string;operatorName:string|null;version:number;netRmb:number|null;netUsd:number|null;margin:number|null;savedAt:string;snapshot:{fields:Record<string,string>;result?:Record<string,unknown>}};
type Product={id:string;name:string;specCode:string;productCode:string;attribute:string;netRmb:number|null;netUsd:number|null;margin:number|null;snapshot?:{fields?:Record<string,string>}|null};
type ApiResponse={product:Product;record:HistoryRecord;records:HistoryRecord[];missingVersions:string[]};

const money=(value:number|null,unit='RMB')=>value===null||!Number.isFinite(value)?'—':new Intl.NumberFormat('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value)+' '+unit;
const percent=(value:number|null)=>value===null||!Number.isFinite(value)?'—':(value*100).toFixed(2)+'%';
const date=(value:string)=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const profitTone=(value:number|null)=>value===null||!Number.isFinite(value)||value===0?'neutral':value>0?'positive':'negative';
const delta=(current:number|null,previous:number|null)=>current===null||previous===null?null:current-previous;

function Trend({records}:{records:HistoryRecord[]}){
 const wrapper=useRef<HTMLDivElement>(null),[viewport,setViewport]=useState(760);
 useEffect(()=>{const node=wrapper.current;if(!node)return;const observer=new ResizeObserver(entries=>{const size=entries[0]?.contentRect.width;if(size)setViewport(Math.floor(size))});observer.observe(node);return()=>observer.disconnect()},[]);
 const profitValues=records.map(item=>item.netRmb),marginValues=records.map(item=>item.margin===null?null:item.margin*100);
 const label=(value:number,kind:'profit'|'margin')=>value.toFixed(2)+(kind==='margin'?'%':'');
 const labelWidth=Math.max(84,...profitValues.filter((n):n is number=>n!==null).map(n=>label(n,'profit').length*7),...marginValues.filter((n):n is number=>n!==null).map(n=>label(n,'margin').length*7));
 const height=310,padX=76,padTop=44,padBottom=48,width=Math.max(viewport,padX*2+labelWidth+32+(records.length-1)*(labelWidth+24));
 const xFor=(index:number)=>padX+labelWidth/2+16+(records.length===1?0.5:index/Math.max(1,records.length-1))*(width-padX*2-labelWidth-32);
 function series(values:(number|null)[]){
  const valid=values.filter((n):n is number=>n!==null&&Number.isFinite(n));
  const low=valid.length?Math.min(...valid):0,high=valid.length?Math.max(...valid):1,buffer=(high-low||Math.max(Math.abs(high),1))*.18;
  const min=low-buffer,max=high+buffer;
  const yFor=(n:number)=>height-padBottom-(n-min)/(max-min)*(height-padTop-padBottom);
  return {min,max,yFor,points:values.map((value,index)=>({x:xFor(index),y:value===null||!Number.isFinite(value)?null:yFor(value),value}))};
 }
 const profit=series(profitValues),margin=series(marginValues);
 if(![...profitValues,...marginValues].some(n=>n!==null&&Number.isFinite(n)))return <div className="product-empty-chart">暂无利润数据</div>;
 const path=(points:typeof profit.points)=>{let next=true;return points.map(p=>{if(p.y===null){next=true;return ''}const segment=`${next?'M':'L'} ${p.x} ${p.y}`;next=false;return segment}).join(' ')};
 return <div className="product-chart-wrap" ref={wrapper}>
  <div className="chart-caption chart-caption-top"><span className="chart-legend-item chart-caption-profit"><i aria-hidden="true"/>净利润（左轴·元）</span><span className="chart-legend-item chart-caption-margin"><i aria-hidden="true"/>利润率（右轴·%）</span></div>
  <div className="product-chart-scroll"><svg className="product-chart" style={{minWidth:width,height:height}} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="净利润与利润率趋势，左右轴分别为人民币和百分比">
   {Array.from({length:5},(_,index)=>{const ratio=index/4,y=padTop+ratio*(height-padTop-padBottom);return <g key={index} className="chart-grid" aria-hidden="true"><line x1={padX} y1={y} x2={width-padX} y2={y}/><text className="chart-tick chart-value-profit" x={padX-12} y={y+3} textAnchor="end">{(profit.max-ratio*(profit.max-profit.min)).toLocaleString('zh-CN',{maximumFractionDigits:2})}</text><text className="chart-tick chart-value-margin" x={width-padX+12} y={y+3}>{(margin.max-ratio*(margin.max-margin.min)).toFixed(2)}%</text></g>})}
   <line className="chart-axis" x1={padX} y1={height-padBottom} x2={width-padX} y2={height-padBottom}/>
   <path className="chart-line chart-line-profit" d={path(profit.points)}/><path className="chart-line chart-line-margin" d={path(margin.points)}/>
   {records.map((item,index)=>{const p=profit.points[index],m=margin.points[index];let py=p.y===null?0:p.y-12,my=m.y===null?0:m.y-12;
    if(p.y!==null&&m.y!==null&&Math.abs(py-my)<24){py=Math.min(p.y,m.y)-14;my=Math.max(p.y,m.y)+22;}
    return <g key={item.version}><title>{`第${item.version}版：净利润 ${p.value===null?'未计算':label(p.value,'profit')+' 元'}；利润率 ${m.value===null?'未计算':label(m.value,'margin')}`}</title>
     {p.value!==null&&p.y!==null&&<><circle className="chart-dot chart-dot-profit" cx={p.x} cy={p.y} r="2.5"/><text className="chart-value chart-value-profit" x={p.x} y={py} textAnchor="middle">{label(p.value,'profit')}</text></>}
     {m.value!==null&&m.y!==null&&<><circle className="chart-dot chart-dot-margin" cx={m.x} cy={m.y} r="2.5"/><text className="chart-value chart-value-margin" x={m.x} y={my} textAnchor="middle">{label(m.value,'margin')}</text></>}
     <text className="chart-label" x={xFor(index)} y={height-14} textAnchor="middle">第{item.version}版</text>
    </g>})}
  </svg></div>
 </div>;
}

export default function ProductHistoryPage(){
 const params=useParams();
 const listHref=useHistoryReturn();
 const productId=typeof params.productId==='string'?params.productId:'';
 const [data,setData]=useState<ApiResponse|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{if(!productId)return;let active=true;setLoading(true);fetch('/api/profit/records/'+encodeURIComponent(productId)+'/versions').then(async response=>{const payload=await response.json();if(!response.ok)throw Error(payload.error||'版本历史加载失败');if(active)setData(payload)}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'版本历史加载失败')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[productId]);
 const latest=data?.record??null;
 const first=data?.records.find(item=>item.version===1)??null;
 const previous=data&&latest?data.records.find(item=>item.version===latest.version-1)??null:null;
 const imageId=latest?.snapshot.fields.photoId||data?.product.snapshot?.fields?.photoId;
 const currentDelta=latest?delta(latest.netRmb,previous?.netRmb??null):null;
 const firstDelta=latest&&first&&latest.version!==first.version?delta(latest.netRmb,first.netRmb):null;
 const tableRows=useMemo(()=>data?.records.slice().reverse()??[],[data]);
 if(loading)return <main className="product-history-page"><div className="product-history-loading">正在加载商品历史…</div></main>;
 if(error||!data||!latest)return <main className="product-history-page"><Link className="product-back" href={listHref}>← 返回历史记录</Link><div className="product-history-error">{error||'暂无该商品的测算历史。'}</div></main>;
 const product=data.product;
 return <main className="product-history-page">
  <header className="product-history-header"><Link className="product-back" href={listHref}>← 返回历史记录</Link><div className="product-header-actions"><ExportExcel recordId={latest.id} name={latest.name}/><Link className="product-secondary-action" href={withHistoryReturn(`/calculator?record=${encodeURIComponent(latest.id)}&returnTo=detail`,listHref)}>基于上次数据测算</Link></div></header>
  <TimeDisplay/>
  <section className="product-hero">
   <div className="product-cover">{imageId&&/^[0-9a-f-]{36}$/i.test(imageId)?<Image unoptimized src={'/api/profit/product-photos/'+imageId} width={152} height={152} alt="商品图片"/>:<div className="product-cover-placeholder">商品</div>}</div>
   <div className="product-meta"><h1>{product.name||latest.name||'未命名商品'}</h1><p>规格编码：{product.specCode||latest.specCode||'—'}　商品编码：{product.productCode||latest.productCode||'—'}</p><small>共 {data.records.length} 个已保存版本 · 当前第 {latest.version} 版 · 最近更新 {date(latest.savedAt)}</small></div>
  </section>
  <section className="product-kpis"><article><span>最新单笔净利润</span><strong>{money(latest.netRmb)}</strong><small>美元 {money(latest.netUsd,'USD')}</small></article><article><span>最新利润率</span><strong>{percent(latest.margin)}</strong><small>第 {latest.version} 版</small></article><article><span>较上一版净利润</span><strong className={currentDelta===null?'muted':currentDelta>=0?'positive':'negative'}>{currentDelta===null?'—':(currentDelta>=0?'+':'')+money(currentDelta)}</strong><small>{previous?'对比第 '+previous.version+' 版':latest.version===1?'暂无上一版':'上一版旧数据未保留'}</small></article><article><span>较第1版净利润</span><strong className={firstDelta===null?'muted':firstDelta>=0?'positive':'negative'}>{firstDelta===null?'—':(firstDelta>=0?'+':'')+money(firstDelta)}</strong><small>{first?'对比第 1 版':'第 1 版旧数据未保留'}</small></article></section>
  <section className="product-panel"><div className="product-panel-heading"><div><h2>单笔净利润趋势</h2><p>按版本顺序展示本单每次保存的结果</p></div><div className="product-latest-badge">当前第 {latest.version} 版</div></div><Trend records={data.records}/>{data.missingVersions.length>0&&<p role="status" className="product-version-note">第 {data.missingVersions.join("、")} 版在旧存储方式中已被覆盖，无法还原完整数据；后续保存的每一版都会保留。</p>}</section>
  <section className="product-panel"><div className="product-panel-heading"><div><h2>版本记录</h2><p>每版保留当时的测算数据和配置</p></div></div><div className="product-table-wrap"><table className="product-history-table"><thead><tr><th>版本</th><th>保存时间</th><th>操作人</th><th>本次变化</th><th>净利润</th><th>利润率</th><th>较上一版</th><th>较第1版</th><th>操作</th></tr></thead><tbody>{tableRows.map((item,index)=>{const before=data.records.find(record=>record.version===item.version-1)??null;const change=delta(item.netRmb,before?.netRmb??null);const fromFirst=first&&item.version!==first.version?delta(item.netRmb,first.netRmb):null;return <tr key={item.version} className={item.version===latest.version?'current-row':''}><td><strong>第 {item.version} 版</strong>{item.version===latest.version&&<em>当前</em>}</td><td>{date(item.savedAt)}</td><td>{item.operatorName||'未记录'}</td><td>{change===null?(item.version===1?'首次保存':'上一版数据未保留'):change===0?'结果未变':change>0?'利润上升':'利润下降'}</td><td className={"table-money "+profitTone(item.netRmb)}>{money(item.netRmb)}</td><td className={profitTone(item.margin)}>{percent(item.margin)}</td><td className={change===null?'':change>=0?'positive':'negative'}>{change===null?'—':(change>=0?'+':'')+money(change)}</td><td className={fromFirst===null?'':fromFirst>=0?'positive':'negative'}>{fromFirst===null?'—':(fromFirst>=0?'+':'')+money(fromFirst)}</td><td><Link className="product-detail-link" href={withHistoryReturn(`/history/record/${encodeURIComponent(item.id)}/version/${item.version}`,listHref)}>查看明细</Link></td></tr>})}</tbody></table></div></section>
 </main>;
}
