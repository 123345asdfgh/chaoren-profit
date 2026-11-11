'use client';
import {useEffect,useRef,useState} from 'react';
import TimeCore from '../public/legacy/time-core';
import './shared-time.css';

const zones=[['America/Los_Angeles','洛杉矶 · 太平洋'],['America/New_York','纽约 · 东部'],['America/Chicago','芝加哥 · 中部'],['America/Denver','丹佛 · 山地']];
const phaseNames={morning:'上午 · 蓝天白云',noon:'正午 · 明亮日光',dusk:'黄昏 · 落日晚霞',night:'夜晚 · 静谧月色'};
const pad=(value:number)=>String(value).padStart(2,'0');
const dateText=(date:Date)=>`${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}`;
const local=(timestamp:number,zone:string)=>TimeCore.local(timestamp,zone) as string;

function DateTimeField({prefix,title,value,zone,onConvert,onError,onPause}:{prefix:string;title:string;value:string;zone:string;onConvert:(value:string)=>boolean;onError:(message:string)=>void;onPause:()=>void}){
 const [date,setDate]=useState(''),[time,setTime]=useState(''),[open,setOpen]=useState(false),[year,setYear]=useState(2026),[month,setMonth]=useState(0),[invalid,setInvalid]=useState<'date'|'time'|null>(null);
 const field=useRef<HTMLDivElement>(null),toggle=useRef<HTMLButtonElement>(null),focused=useRef<string|null>(null);
 useEffect(()=>{if(focused.current!=='date')setDate(value.slice(0,10));if(focused.current!=='time'&&focused.current!=='parts')setTime(value.slice(11));setInvalid(null)},[value]);
 useEffect(()=>{
  if(!open)return;
  const dismiss=(event:PointerEvent)=>{if(!field.current?.contains(event.target as Node))setOpen(false)};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);toggle.current?.focus()}};
  document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape)};
 },[open]);
 function convert(nextDate:string,nextTime:string,showError=true){
  const parsed=new Date(nextDate+'T00:00:00Z'),parts=nextTime.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  const normalized=parts?parts.slice(1).map(part=>pad(Number(part||0))).join(':'):'';
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(nextDate)||!Number.isFinite(parsed.getTime())||dateText(parsed)!==nextDate){if(showError){setInvalid('date');onError('请按 YYYY-MM-DD 填写2000–2099年内的有效日期。')}return false}
  if(!/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(normalized)){if(showError){setInvalid('time');onError('请填写有效时间（时0–23，分和秒0–59）。')}return false}
  setInvalid(null);return onConvert(nextDate+'T'+normalized);
 }
 function chooseDate(nextDate:string){setDate(nextDate);setYear(Number(nextDate.slice(0,4)));setMonth(Number(nextDate.slice(5,7))-1);convert(nextDate,time)}
 function moveMonth(step:number){const next=new Date(Date.UTC(year,month+step,1));setYear(next.getUTCFullYear());setMonth(next.getUTCMonth())}
 const start=new Date(Date.UTC(year,month,1));start.setUTCDate(1-(start.getUTCDay()+6)%7);
 const today=local(Date.now(),zone).slice(0,10),timeParts=time.split(':');
 return <div className="history-time-field" ref={field}>
  <label htmlFor={prefix+'-date-entry'}>{title}日期与时间</label>
  <div className="history-time-controls">
   <div className="history-time-date-entry"><input id={prefix+'-date-entry'} aria-label={title+'日期'} aria-invalid={invalid==='date'} aria-describedby="history-time-message" type="text" inputMode="numeric" maxLength={10} placeholder="YYYY-MM-DD" value={date} onFocus={()=>{focused.current='date';onPause()}} onChange={event=>{setDate(event.target.value);convert(event.target.value,time,false)}} onBlur={()=>{focused.current=null;convert(date,time)}} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur()}}/>
   <button type="button" className="history-time-calendar-toggle" ref={toggle} aria-label={'选择'+title+'日期'} aria-expanded={open} aria-controls={prefix+'-calendar'} disabled={!value} onClick={()=>{onPause();if(!open){const selected=/^20\d{2}-\d{2}/.test(date)?date:value;setYear(Number(selected.slice(0,4)));setMonth(Number(selected.slice(5,7))-1)}setOpen(!open)}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 11h18M7 15h2M12 15h2M7 18h2"/></svg></button></div>
   <input aria-label={title+'时分秒'} aria-invalid={invalid==='time'} aria-describedby="history-time-message" type="text" inputMode="numeric" maxLength={8} placeholder="HH:mm:ss" value={time} onFocus={()=>{focused.current='time';onPause()}} onChange={event=>{setTime(event.target.value);convert(date,event.target.value,false)}} onBlur={()=>{focused.current=null;convert(date,time)}} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur()}}/>
  </div>
  {open&&<div className="history-time-calendar" id={prefix+'-calendar'} role="dialog" aria-label={title+'日期选择'}>
   <div className="history-time-calendar-heading"><button type="button" aria-label="上个月" disabled={year===2000&&month===0} onClick={()=>moveMonth(-1)}>‹</button><select aria-label={title+'年份'} value={year} onChange={event=>setYear(Number(event.target.value))}>{Array.from({length:100},(_,index)=><option key={index} value={2000+index}>{2000+index}年</option>)}</select><select aria-label={title+'月份'} value={month} onChange={event=>setMonth(Number(event.target.value))}>{Array.from({length:12},(_,index)=><option key={index} value={index}>{index+1}月</option>)}</select><button type="button" aria-label="下个月" disabled={year===2099&&month===11} onClick={()=>moveMonth(1)}>›</button></div>
   <div className="history-time-calendar-week" aria-hidden="true">{['一','二','三','四','五','六','日'].map(day=><span key={day}>{day}</span>)}</div>
   <div className="history-time-calendar-days">{Array.from({length:42},(_,index)=>{const day=new Date(start);day.setUTCDate(start.getUTCDate()+index);const text=dateText(day);return <button type="button" key={text} aria-label={text} aria-pressed={text===date} aria-current={text===today?'date':undefined} className={day.getUTCMonth()!==month?'outside-month':''} disabled={day.getUTCFullYear()<2000||day.getUTCFullYear()>2099} onClick={()=>chooseDate(text)}>{day.getUTCDate()}</button>})}</div>
   <div className="history-time-calendar-time">{['时','分','秒'].map((unit,index)=><label key={unit}><span>{unit}</span><input type="number" min={0} max={index===0?23:59} step={1} inputMode="numeric" aria-label={title+unit} value={timeParts[index]??''} onFocus={()=>{focused.current='parts'}} onBlur={()=>{focused.current=null}} onChange={event=>{const next=[...timeParts];next[index]=event.target.value===''?'':pad(Number(event.target.value));const nextTime=next.join(':');setTime(nextTime);convert(date,nextTime)}}/></label>)}</div>
   <div className="history-time-calendar-footer"><button type="button" onClick={()=>chooseDate(today)}>今天</button><button type="button" className="calendar-done" onClick={()=>{if(convert(date,time)){setOpen(false);toggle.current?.focus()}}}>完成</button></div>
  </div>}
 </div>;
}

export default function TimeDisplay(){
 const [timestamp,setTimestamp]=useState<number|null>(null),[live,setLive]=useState(true),[zone,setZone]=useState(zones[0][0]),[fx,setFx]=useState('6.8'),[expanded,setExpanded]=useState(true),[message,setMessage]=useState(''),[candidates,setCandidates]=useState<number[]>([]),[occurrence,setOccurrence]=useState(0);
 const zoneTouched=useRef(false),fxTouched=useRef(false),fxSaveTimer=useRef<ReturnType<typeof setTimeout>|null>(null),fxSaveGeneration=useRef(0);
 useEffect(()=>()=>{if(fxSaveTimer.current!==null)clearTimeout(fxSaveTimer.current);fxSaveGeneration.current++},[]);
 useEffect(()=>{setTimestamp(Date.now());let active=true;void fetch('/api/profit/settings').then(response=>response.ok?response.json():null).then(data=>{if(!active)return;if(data?.fields?.zone&&zones.some(([value])=>value===data.fields.zone)&&!zoneTouched.current)setZone(data.fields.zone);if(data?.fields?.fx&&!fxTouched.current)setFx(data.fields.fx)}).catch(()=>{});return()=>{active=false}},[]);
 useEffect(()=>{if(!live)return;setTimestamp(Date.now());const timer=setInterval(()=>setTimestamp(Date.now()),1000);return()=>clearInterval(timer)},[live]);
 function convert(value:string,inputZone:string){
  setLive(false);const matches=TimeCore.resolve(value,inputZone) as number[];setCandidates(matches);setOccurrence(0);
  if(!matches.length){setMessage('该时间因夏令时跳时不存在，请重新填写。');return false}
  setMessage('');setTimestamp(matches[0]);return true;
 }
 function scheduleFxSave(value:string){
  if(value===''||!Number.isFinite(Number(value))||Number(value)<=0)return;
  if(fxSaveTimer.current!==null)clearTimeout(fxSaveTimer.current);
  const generation=++fxSaveGeneration.current;
  fxSaveTimer.current=setTimeout(()=>{fxSaveTimer.current=null;void (async()=>{
   try{
    const response=await fetch('/api/profit/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({fields:{fx:value}})});
    if(!response.ok)throw Error('结算汇率保存失败');
    if(generation!==fxSaveGeneration.current)return;
   }catch{
    if(generation===fxSaveGeneration.current)setMessage('结算汇率保存失败，请重试。');
   }
  })()},350);
 }
 return <section className="history-time" aria-label="中美时差换算">
  {(['cn','center','us'] as const).map(side=>{
   if(side==='center')return <div key={side} className="history-time-center"><span>{live?'● 实时同步':'◷ 自定义时间'}</span><strong>{timestamp===null?'—':`北京快 ${(TimeCore.offset(timestamp,'Asia/Shanghai')-TimeCore.offset(timestamp,zone))/60} 小时`}</strong><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'收起时间换算 ↑':'换算其他时间 ↗'}</button></div>;
   const inputZone=side==='cn'?'Asia/Shanghai':zone,phase=timestamp===null?'morning':TimeCore.phase(timestamp,inputZone) as keyof typeof phaseNames;
   return <div key={side} className="history-time-cell" data-phase={phase}>
    <div className="history-time-label">{side==='cn'?<><span>北京时间</span><div className="history-clock-fx"><label htmlFor="history-fx">结算汇率</label><input id="history-fx" aria-label="结算汇率，1美元对应人民币" type="number" min="0.000001" max="1000000000" step="any" value={fx} onChange={event=>{const value=event.target.value;fxTouched.current=true;setFx(value);scheduleFxSave(value)}}/></div></>:<><label htmlFor="history-zone">美国时间</label><select id="history-zone" aria-label="美国时间地区" value={zone} onChange={event=>{zoneTouched.current=true;setZone(event.target.value);setCandidates([]);setMessage('')}}>{zones.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></>}</div>
    <div className="history-clock">{timestamp===null?'--:--:--':local(timestamp,inputZone).slice(11)}</div>
    <div className="history-clock-date">{timestamp===null?'—':new Intl.DateTimeFormat('zh-CN',{timeZone:inputZone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).format(timestamp)}</div>
    <div className="history-scene-caption" title="按当地时间切换的背景氛围，不代表实时天气">{phaseNames[phase]}</div>
   </div>;
  })}
  {expanded&&<div className="history-time-edit">
   <DateTimeField prefix="history-cn" title="北京" value={timestamp===null?'':local(timestamp,'Asia/Shanghai')} zone="Asia/Shanghai" onConvert={value=>convert(value,'Asia/Shanghai')} onError={setMessage} onPause={()=>setLive(false)}/>
   <DateTimeField prefix="history-us" title="美国" value={timestamp===null?'':local(timestamp,zone)} zone={zone} onConvert={value=>convert(value,zone)} onError={setMessage} onPause={()=>setLive(false)}/>
   <button type="button" className="history-time-now" onClick={()=>{setTimestamp(Date.now());setLive(true);setMessage('');setCandidates([])}}>回到当前时间</button>
   <p id="history-time-message" className="history-time-error" role="status">{message}</p>
   {candidates.length>1&&<label className="history-time-fold">夏令时重复时间，选择第几次<select value={occurrence} onChange={event=>{const index=Number(event.target.value);setOccurrence(index);setTimestamp(candidates[index])}}>{candidates.map((value,index)=><option key={value} value={index}>第{index+1}次 → 北京 {local(value,'Asia/Shanghai').replace('T',' ')}</option>)}</select></label>}
  </div>}
 </section>;
}
