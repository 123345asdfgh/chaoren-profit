
'use client';
import {useEffect,useRef} from 'react';
import TimeCore from '../public/legacy/time-core';
import TimeWidget from '../public/legacy/time-widget';
import './shared-time.css';
export default function TimeDisplay(){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!root.current)return;
  const element=root.current;element.innerHTML=TimeWidget.markup;
  const fx=element.querySelector<HTMLInputElement>('#fx')!,zone=element.querySelector<HTMLSelectElement>('#zone-setting')!;
  let active=true,fxTouched=false,zoneTouched=false,timer:ReturnType<typeof setTimeout>|null=null,generation=0;
  const widget=TimeWidget.mount(element,{core:TimeCore});
  void fetch('/api/profit/settings').then(response=>response.ok?response.json():null).then(data=>{if(!active)return;if(data?.fields?.fx&&!fxTouched)fx.value=data.fields.fx;if(!zoneTouched&&data?.fields?.zone&&Array.from(zone.options).some(option=>option.value===data.fields.zone))zone.value=data.fields.zone;widget.render()}).catch(()=>{});
  const touch=()=>{zoneTouched=true};
  const save=()=>{fxTouched=true;const value=fx.value,attempt=++generation;if(timer!==null)clearTimeout(timer);if(!fx.validity.valid||value===''||Number(value)<=0)return;timer=setTimeout(()=>{timer=null;void fetch('/api/profit/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({fields:{fx:value}})}).then(response=>{if(!response.ok)throw Error('结算汇率保存失败')}).catch(()=>{if(active&&attempt===generation){const message=element.querySelector('#time-message')!;message.textContent='结算汇率保存失败，请重试。';message.classList.add('input-error')}})},350)};
  fx.addEventListener('input',save);zone.addEventListener('change',touch);
  return()=>{active=false;generation++;if(timer!==null)clearTimeout(timer);fx.removeEventListener('input',save);zone.removeEventListener('change',touch);widget.destroy()};
 },[]);
 return <div ref={root} className="shared-time-root"/>;
}
