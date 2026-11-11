'use client';

import {useEffect,useMemo,useState} from 'react';
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
 const width=760,height=300,padX=42,padY=34;
 const xFor=(index:number)=>padX+(records.length===1?0.5:index/Math.max(1,records.length-1))*(width-padX*2);
 const profitValues=records.map(item=>item.netRmb);
 const marginValues=records.map(item=>item.margin===null?null:item.margin*100);
 const allValues=[...profitValues,...marginValues].filter((item):item is number=>item!==null&&Number.isFinite(item));
 const scaleMin=allValues.length?Math.min(...allValues):0,scaleMax=allValues.length?Math.max(...allValues):1,scaleRange=scaleMax-scaleMin||1;
 const buildPoints=(values:(number|null)[])=>{const points=values.map((value,index)=>{const x=xFor(index);const y=value===null?null:height-padY-(value-scaleMin)/scaleRange*(height-padY*2);return {x,y,value,item:records[index]}});return {points,validPoints:points.filter((point):point is {x:number;y:number;value:number;item:HistoryRecord}=>point.value!==null&&point.y!==null)} };
 const profit=buildPoints(profitValues);
 const margin=buildPoints(marginValues);
 if(!profit.validPoints.length&&!margin.validPoints.length)return <div className="product-empty-chart">暂无利润数据</div>;
 const label=(value:number,kind:'profit'|'margin')=>kind==='profit'?value.toFixed(0):value.toFixed(2)+'%';
 return <div className="product-chart-wrap">
  <div className="chart-caption chart-caption-top"><span className="chart-legend-item chart-caption-profit"><i aria-hidden="true"/>净利润</span><span className="chart-legend-item chart-caption-margin"><i aria-hidden="true"/>利润率</span></div>
  <svg className="product-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="净利润与利润率趋势">
   <g className="chart-grid" aria-hidden="true">{Array.from({length:6},(_,index)=>{const y=padY+index*(height-padY*2)/5;return <line key={index} x1={padX} y1={y} x2={width-padX} y2={y}/>})}</g>
   <line className="chart-axis" x1={padX} y1={height-padY} x2={width-padX} y2={height-padY}/><line className="chart-axis" x1={padX} y1={padY} x2={padX} y2={height-padY}/>
   {profit.validPoints.length>1&&<polyline className="chart-line chart-line-profit" points={profit.validPoints.map(point=>`${point.x},${point.y}`).join(' ')}/>}
   {margin.validPoints.length>1&&<polyline className="chart-line chart-line-margin" points={margin.validPoints.map(point=>`${point.x},${point.y}`).join(' ')}/>}
   {records.map((item,index)=>{const profitPoint=profit.points[index],marginPoint=margin.points[index];return <g key={item.version}><title>{`第${item.version}版`}</title>
    {profitPoint.value!==null&&profitPoint.y!==null&&<><circle className="chart-dot chart-dot-profit" cx={profitPoint.x} cy={profitPoint.y} r="2.5"/><text className="chart-value chart-value-profit" x={profitPoint.x} y={Math.max(16,profitPoint.y-9)} textAnchor="middle">{label(profitPoint.value,'profit')}</text></>}
    {marginPoint.value!==null&&marginPoint.y!==null&&<><circle className="chart-dot chart-dot-margin" cx={marginPoint.x} cy={marginPoint.y} r="2.5"/><text className="chart-value chart-value-margin" x={marginPoint.x} y={Math.max(16,marginPoint.y-9)} textAnchor="middle">{label(marginPoint.value,'margin')}</text></>}
    <text className="chart-label" x={xFor(index)} y={height-8} textAnchor="middle">第{item.version}版</text>
   </g>})}
  </svg>
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
  <header className="product-history-header"><Link className="product-back" href={listHref}>← 返回历史记录</Link><div className="product-header-actions"><ExportExcel recordId={latest.id} name={latest.name}/><Link className="product-secondary-action" href={withHistoryReturn(`/calculator?record=${encodeURIComponent(latest.id)}`,listHref)}>基于上次数据测算</Link></div></header>
  <TimeDisplay/>
  <section className="product-hero">
   <div className="product-cover">{imageId&&/^[0-9a-f-]{36}$/i.test(imageId)?<Image unoptimized src={'/api/profit/product-photos/'+imageId} width={152} height={152} alt="商品图片"/>:<div className="product-cover-placeholder">商品</div>}</div>
   <div className="product-meta"><h1>{product.name||latest.name||'未命名商品'}</h1><p>规格编码：{product.specCode||latest.specCode||'—'}　商品编码：{product.productCode||latest.productCode||'—'}</p><small>共 {data.records.length} 个已保存版本 · 当前第 {latest.version} 版 · 最近更新 {date(latest.savedAt)}</small></div>
  </section>
  <section className="product-kpis"><article><span>最新单笔净利润</span><strong>{money(latest.netRmb)}</strong><small>美元 {money(latest.netUsd,'USD')}</small></article><article><span>最新利润率</span><strong>{percent(latest.margin)}</strong><small>第 {latest.version} 版</small></article><article><span>较上一版净利润</span><strong className={currentDelta===null?'muted':currentDelta>=0?'positive':'negative'}>{currentDelta===null?'—':(currentDelta>=0?'+':'')+money(currentDelta)}</strong><small>{previous?'对比第 '+previous.version+' 版':latest.version===1?'暂无上一版':'上一版旧数据未保留'}</small></article><article><span>较第1版净利润</span><strong className={firstDelta===null?'muted':firstDelta>=0?'positive':'negative'}>{firstDelta===null?'—':(firstDelta>=0?'+':'')+money(firstDelta)}</strong><small>{first?'对比第 1 版':'第 1 版旧数据未保留'}</small></article></section>
  <section className="product-panel"><div className="product-panel-heading"><div><h2>单笔净利润趋势</h2><p>按版本顺序展示本单每次保存的结果</p></div><div className="product-latest-badge">当前第 {latest.version} 版</div></div><Trend records={data.records}/>{data.missingVersions.length>0&&<p role="status" className="product-version-note">第 {data.missingVersions.join("、")} 版在旧存储方式中已被覆盖，无法还原完整数据；后续保存的每一版都会保留。</p>}</section>
  <section className="product-panel"><div className="product-panel-heading"><div><h2>版本记录</h2><p>每版保留当时的测算数据和配置</p></div></div><div className="product-table-wrap"><table className="product-history-table"><thead><tr><th>版本</th><th>保存时间</th><th>本次变化</th><th>净利润</th><th>利润率</th><th>较上一版</th><th>较第1版</th><th>操作</th></tr></thead><tbody>{tableRows.map((item,index)=>{const before=data.records.find(record=>record.version===item.version-1)??null;const change=delta(item.netRmb,before?.netRmb??null);const fromFirst=first&&item.version!==first.version?delta(item.netRmb,first.netRmb):null;return <tr key={item.version} className={item.version===latest.version?'current-row':''}><td><strong>第 {item.version} 版</strong>{item.version===latest.version&&<em>当前</em>}</td><td>{date(item.savedAt)}</td><td>{change===null?(item.version===1?'首次保存':'上一版数据未保留'):change===0?'结果未变':change>0?'利润上升':'利润下降'}</td><td className={"table-money "+profitTone(item.netRmb)}>{money(item.netRmb)}</td><td className={profitTone(item.margin)}>{percent(item.margin)}</td><td className={change===null?'':change>=0?'positive':'negative'}>{change===null?'—':(change>=0?'+':'')+money(change)}</td><td className={fromFirst===null?'':fromFirst>=0?'positive':'negative'}>{fromFirst===null?'—':(fromFirst>=0?'+':'')+money(fromFirst)}</td><td><Link className="product-detail-link" href={withHistoryReturn(`/history/record/${encodeURIComponent(item.id)}/version/${item.version}`,listHref)}>查看明细</Link></td></tr>})}</tbody></table></div></section>
 </main>;
}
