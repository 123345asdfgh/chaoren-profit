'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useHistoryReturn,withHistoryReturn} from '../../return-navigation';
import {ArrowLeft,Calculator,Clock3,FileText,SlidersHorizontal} from 'lucide-react';
import FreightDetails,{type FreightConfig,type FreightEstimate} from '../../freight-details';
import ExportExcel from '../../export-excel';
import '../../../shared.css';
import './record-detail.css';

type Fee={key:string;name:string;rate:number;basis:string;usd:number;rmb:number};
type Result={grossRmb:number;grossUsd:number;revenueRmb:number;revenueUsd:number;costRmb:number;costUsd:number;logisticsRmb:number;logisticsUsd:number;pretaxUsd:number;taxUsd:number;netRmb:number;netUsd:number;margin:number|null;fees:Fee[]};
type Quote=FreightEstimate&{mode:string;length:number;width:number;height:number;weight:number};
type Snapshot={fields:Record<string,string>;result?:Result|null;freight?:FreightConfig;quote?:Quote|null};
type RecordData={id:string;productId:string|null;name:string;category:string;specCode:string;productCode:string;operatorName:string|null;version:number;isCurrent?:boolean;netRmb:number|null;netUsd:number|null;margin:number|null;savedAt:string;snapshot:Snapshot};
type HistoryData={records:RecordData[]};
type DetailRow=[string,string];

const isNumber=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const amount=(value:unknown)=>isNumber(value)?value.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const money=(value:unknown,unit='RMB')=>isNumber(value)?`${amount(value)} ${unit}`:'—';
const percent=(value:unknown)=>isNumber(value)?(value*100).toFixed(2)+'%':'—';
const date=(value:string)=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const value=(fields:Record<string,string>,key:string,unit='')=>fields[key]?`${fields[key]}${unit?' '+unit:''}`:'—';
const numeric=(fields:Record<string,string>,key:string)=>fields[key]!==undefined&&fields[key]!==''&&Number.isFinite(Number(fields[key]))?Number(fields[key]):null;
const delta=(a:number|null|undefined,b:number|null|undefined)=>isNumber(a)&&isNumber(b)?a-b:null;
const signed=(n:number|null,unit='RMB')=>n===null?'—':`${n>=0?'+':''}${money(n,unit)}`;
const feeNames=[['promotion','推广费'],['operation','代运营'],['platform','平台佣金'],['royalty','版权费'],['labor','人工成本'],['other','其他费用']] as const;
const labels:Record<string,string>={name:'商品名称',specCode:'规格编码',productCode:'商品编码',attribute:'商品属性',chinaPrice:'中国组合价',salePrice:'美区商品售价',buyerShipping:'买家支付运费',receipt:'最终含税实收',logistics:'实际物流成本',currency:'物流币种',fx:'结算汇率',costRate:'产品成本比例',multiplier:'参考售价倍率',divisor:'去税除数',tax:'所得税率',length:'长',width:'宽',height:'高',weight:'实重',packType:'尺寸类型',store:'发货店铺',zone:'美国时区',photoId:'商品照片',...Object.fromEntries(feeNames)};
const displayField=(key:string,v:string|undefined)=>v===undefined||v===''?'未填写':key==='packType'?(v==='naked'?'裸货尺寸':'包裹尺寸'):key==='photoId'?'已上传照片':v;

function DetailRows({rows}:{rows:DetailRow[]}){return <dl className="record-detail-rows">{rows.map(([label,v])=><div key={label}><dt>{label}</dt><dd>{v}</dd></div>)}</dl>}
function DeltaRows({record,previous,first}:{record:RecordData;previous:RecordData|null;first:RecordData|null}){
 const last=delta(record.netRmb,previous?.netRmb),initial=first?.version===record.version?null:delta(record.netRmb,first?.netRmb);
 const points=(other:RecordData|null)=>{const n=delta(record.margin,other?.margin);return n===null?'—':`${n>=0?'+':''}${(n*100).toFixed(2)} 个百分点`};
 return <div className="record-result-comparison"><div><span>较上一版净利润</span><strong>{signed(last)} / {signed(delta(record.netUsd,previous?.netUsd),'USD')}</strong></div><div><span>较第1版净利润</span><strong>{signed(initial)} / {signed(first?.version===record.version?null:delta(record.netUsd,first?.netUsd),'USD')}</strong></div><div><span>净利率较上一版 / 较第1版</span><strong>{points(previous)} / {first?.version===record.version?'—':points(first)}</strong></div></div>
}
function ResultTable({record,previous,first}:{record:RecordData;previous:RecordData|null;first:RecordData|null}){
 const result=record.snapshot.result,fx=numeric(record.snapshot.fields,'fx');
 const toRmb=(n:unknown)=>isNumber(n)&&fx!==null?n*fx:null;
 const rows:[string,number|null|undefined,number|null|undefined][]=[
  ['含税实收',result?.grossRmb,result?.grossUsd],['去税后营业收入',result?.revenueRmb,result?.revenueUsd],['产品成本',result?.costRmb,result?.costUsd],
  ...feeNames.map(([key,name]):[string,number|null|undefined,number|null|undefined]=>{const fee=result?.fees?.find(item=>item.key===key);return [`${name}${record.snapshot.fields[key]!==''&&record.snapshot.fields[key]!==undefined?' '+record.snapshot.fields[key]+'%':''}${key==='royalty'?'（按成本）':''}`,fee?.rmb,fee?.usd]}),
  ['实际物流成本',result?.logisticsRmb,result?.logisticsUsd],['税前利润',toRmb(result?.pretaxUsd),result?.pretaxUsd],['所得税',toRmb(result?.taxUsd),result?.taxUsd],['净利润',record.netRmb,record.netUsd],
 ];
 return <section className="record-detail-card record-result-card"><div className="record-detail-card-title"><Calculator className="record-detail-icon" aria-hidden="true"/><h2>本次利润拆解</h2></div><div className="record-profit-table-wrap"><table className="record-profit-table"><thead><tr><th>项目</th><th>人民币</th><th>美元</th></tr></thead><tbody>{rows.map(([label,rmb,usd])=><tr key={label} className={label==='净利润'?'record-total-row':''}><td>{label}</td><td>{isNumber(rmb)?'¥'+amount(rmb):'—'}</td><td>{isNumber(usd)?'$'+amount(usd):'—'}</td></tr>)}</tbody></table></div><DeltaRows record={record} previous={previous} first={first}/></section>
}

export default function RecordDetailPage(){
 const params=useParams(),requestedVersion=typeof params.version==='string'?params.version:'',id=typeof params.recordId==='string'?params.recordId:'';
 const listHref=useHistoryReturn();
 const [record,setRecord]=useState<RecordData|null>(null),[records,setRecords]=useState<RecordData[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{if(!id)return;const controller=new AbortController();setLoading(true);setError('');setRecords([]);
  void (async()=>{try{
   const response=await fetch('/api/profit/records/'+encodeURIComponent(id)+(requestedVersion?'/versions/'+encodeURIComponent(requestedVersion):''),{signal:controller.signal}),body=await response.json();if(!response.ok)throw Error(body.error||'测算详情加载失败');setRecord(body);
   const historyResponse=await fetch('/api/profit/records/'+encodeURIComponent(id)+'/versions',{signal:controller.signal});if(historyResponse.ok){const history:HistoryData=await historyResponse.json();setRecords(history.records)}
  }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'测算详情加载失败')}finally{if(!controller.signal.aborted)setLoading(false)}})();return()=>controller.abort();
 },[id,requestedVersion]);
 const backHref=record?`/history/product/${encodeURIComponent(record.id)}`:'/history';
 if(loading||error||!record)return <main className="record-detail-page"><Link className="record-back" href={withHistoryReturn(backHref,listHref)}><ArrowLeft size={16}/>返回档案</Link><div className="record-detail-state" role="status">{loading?'正在加载测算详情…':error||'测算详情不存在。'}</div></main>;
 const f=record.snapshot.fields,result=record.snapshot.result,quote=record.snapshot.quote;
 const previous=records.find(item=>item.version===record.version-1)??null,first=records.find(item=>item.version===1)??null;
 const price=numeric(f,'chinaPrice'),multiplier=numeric(f,'multiplier'),fx=numeric(f,'fx');
 const reference=price!==null&&multiplier!==null&&fx!==null&&fx>0?price*multiplier/fx:null;
 const trade:DetailRow[]=[['中国组合价',value(f,'chinaPrice','RMB')],['成本比例',value(f,'costRate','%')],['美区商品售价',value(f,'salePrice','USD')],['买家支付运费',value(f,'buyerShipping','USD')],['最终含税实收',value(f,'receipt','USD')],['实际物流成本',value(f,'logistics',f.currency)],['物流币种',value(f,'currency')],['结算汇率',value(f,'fx','RMB/USD')],['折算产品成本',money(result?.costRmb)],['参考国内组合价',value(f,'chinaPrice','RMB')],['参考售价倍率',value(f,'multiplier','倍')],['参考商品售价',money(reference,'USD')]];
 const freight:DetailRow[]=[['发货店铺',value(f,'store')],['商品属性',record.category||value(f,'attribute')],['尺寸类型',f.packType?displayField('packType',f.packType):'—'],['长',value(f,'length','cm')],['宽',value(f,'width','cm')],['高',value(f,'height','cm')],['实重',value(f,'weight','kg')],['渠道',quote?.code||'—'],['计重规则',quote?quote.mode==='actual'?'仅按实重':'实重与材积重取大':'—'],['计费重 / 材积重',quote?`${quote.chargeWeight} / ${quote.volumeWeight} kg`:'—'],['包装后尺寸 / 实重',quote?`${quote.length} × ${quote.width} × ${quote.height} cm / ${quote.weight} kg`:'—'],['单价 / 票费 / 附加费',quote?`${quote.rate} RMB/kg / ${money(quote.fee)} / ${money(quote.extra)}`:'—'],['参考运费',money(quote?.cny)]];
 const currentValues={...f,name:record.name,specCode:record.specCode,productCode:record.productCode};
 const previousValues=previous?{...previous.snapshot.fields,name:previous.name,specCode:previous.specCode,productCode:previous.productCode}:null;
 const changes=previousValues?Object.entries(labels).filter(([key])=>String(currentValues[key as keyof typeof currentValues]??'')!==String(previousValues[key as keyof typeof previousValues]??'')).map(([key,label])=>`${label}：${displayField(key,previousValues[key as keyof typeof previousValues])} → ${displayField(key,currentValues[key as keyof typeof currentValues])}`):[];
 return <main className="record-detail-page">
  <header className="record-detail-header"><Link className="record-back" href={withHistoryReturn(backHref,listHref)}><ArrowLeft size={16}/>返回档案</Link><div><h1>第 {record.version} 版测算明细</h1><p>{record.name||'未命名商品'}　/　商品属性 {record.category||'—'}　/　规格编码 {record.specCode||'—'}　/　商品编码 {record.productCode||'—'}</p></div><ExportExcel recordId={record.id} name={record.name} version={record.version}/></header>
  <div className="record-snapshot-bar"><span>{date(record.savedAt)} 保存　·　操作人：{record.operatorName||'未记录'}</span><strong>第 {record.version} 版</strong></div>
  <div className="record-detail-layout"><div className="record-detail-main">
   <section className="record-detail-card"><div className="record-detail-card-title"><FileText className="record-detail-icon" aria-hidden="true"/><h2>保存时的完整输入</h2></div><div className="record-detail-columns"><div><h3>成交与成本</h3><DetailRows rows={trade}/></div><div><h3>跨境小包物流</h3><DetailRows rows={freight}/></div></div></section>
   <section className="record-detail-card"><div className="record-detail-card-title"><SlidersHorizontal className="record-detail-icon" aria-hidden="true"/><h2>扣点与基础参数</h2></div><div className="record-detail-columns"><div><h3>收入扣点</h3><DetailRows rows={feeNames.filter(([key])=>key!=='royalty').map(([key,label])=>[label,value(f,key,'%')])}/></div><div><h3>成本及税费</h3><DetailRows rows={[["版权费",value(f,'royalty','%')],["去税除数",value(f,'divisor')],["所得税率",value(f,'tax','%')]]}/></div></div>{record.snapshot.freight&&<FreightDetails config={record.snapshot.freight}/>}</section>
   <section className="record-detail-card"><div className="record-detail-card-title"><Clock3 className="record-detail-icon" aria-hidden="true"/><h2>较上一版的输入变化</h2></div>{changes.length?<ul className="record-change-list">{changes.map(change=><li key={change}>{change}</li>)}</ul>:<p className="record-detail-muted">{previous?'与上一版测算的输入一致。':record.version===1?'第1版，暂无上一版记录。':'上一版旧数据未保留，无法对照。'}</p>}</section>
  </div><aside className="record-detail-side"><section className="record-net-card"><span>保存时的单笔净利润</span><strong>{isNumber(record.netRmb)?'¥'+amount(record.netRmb):'—'}</strong><div><b>{money(record.netUsd,'USD')}</b><em>净利率 {percent(record.margin)}</em></div></section><ResultTable record={record} previous={previous} first={first}/><Link className="record-load" href={withHistoryReturn(`/calculator?record=${encodeURIComponent(record.id)}&version=${record.version}`,listHref)}>载入第 {record.version} 版测算</Link></aside></div>
 </main>;
}
