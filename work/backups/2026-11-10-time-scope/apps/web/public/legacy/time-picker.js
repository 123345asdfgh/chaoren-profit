(function(root){
function mount({root=document,core=globalThis.TimeCore,convertClockInput,isLive=()=>true}){
 const TimeCore=core,get=id=>root.querySelector('#'+id),document=root.ownerDocument||root;
 const listeners=[];
 const listen=(node,type,fn)=>{node.addEventListener(type,fn);listeners.push(()=>node.removeEventListener(type,fn));};
 const pickers=[],pad=value=>String(value).padStart(2,'0');
 const dateText=date=>`${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}`;
 let opened=null;
 function close(restoreFocus=false){
  if(!opened)return;
  const picker=opened;picker.panel.hidden=true;picker.toggle.setAttribute('aria-expanded','false');opened=null;
  if(restoreFocus)picker.toggle.focus();
 }
 for(const prefix of ['cn','us']){
  const source=get(prefix+'-time'),field=source.parentElement;
  const title=prefix==='cn'?'北京':'美国';
  // Keep the existing conversion input and DST validation as the source of truth.
  source.hidden=true;field.classList.add('time-picker-field');
  field.querySelector('label').htmlFor=prefix+'-date-entry';
  const controls=document.createElement('div');controls.className='time-picker-controls';
  controls.innerHTML=`<div class="time-date-entry"><input id="${prefix}-date-entry" type="text" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="YYYY-MM-DD" aria-label="${title}日期" aria-describedby="time-message"><button type="button" class="time-calendar-toggle" aria-label="选择${title}日期" aria-expanded="false" aria-controls="${prefix}-calendar"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 11h18M7 15h2M12 15h2M7 18h2"/></svg></button></div><input class="time-hour-entry" type="text" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="HH:mm:ss" aria-label="${title}时分秒" aria-describedby="time-message">`;
  const panel=document.createElement('div');panel.id=prefix+'-calendar';panel.className='time-calendar';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label',title+'日期选择');
  panel.innerHTML=`<div class="time-calendar-heading"><button type="button" data-month-step="-1" aria-label="上个月">‹</button><select class="calendar-year" aria-label="${title}年份"></select><select class="calendar-month" aria-label="${title}月份"></select><button type="button" data-month-step="1" aria-label="下个月">›</button></div><div class="time-calendar-week" aria-hidden="true">${['一','二','三','四','五','六','日'].map(day=>`<span>${day}</span>`).join('')}</div><div class="time-calendar-days" role="group" aria-label="选择日期"></div><div class="time-calendar-time" role="group" aria-label="${title}时间设置">${['时','分','秒'].map((unit,index)=>`<label><span>${unit}</span><input type="number" min="0" max="${index===0?23:59}" step="1" inputmode="numeric" aria-label="${title}${unit}" aria-describedby="time-message"></label>`).join('<span class="time-colon" aria-hidden="true">:</span>')}</div><div class="time-calendar-footer"><button type="button" class="calendar-today">今天</button><button type="button" class="calendar-done">完成</button></div>`;
  field.append(controls,panel);
  const picker={source,field,panel,toggle:controls.querySelector('button'),date:controls.querySelector('input'),time:controls.querySelector('.time-hour-entry'),parts:[...panel.querySelectorAll('.time-calendar-time input')],year:panel.querySelector('.calendar-year'),month:panel.querySelector('.calendar-month'),view:null};pickers.push(picker);
  for(let year=2000;year<=2099;year++)picker.year.add(new Option(year+'年',String(year)));
  for(let month=0;month<12;month++)picker.month.add(new Option(month+1+'月',String(month)));
  const zone=()=>prefix==='cn'?'Asia/Shanghai':get('zone').value;
  const today=()=>TimeCore.local(Date.now(),zone()).slice(0,10);
  function validateAndConvert(){
   const parts=picker.time.value.trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
   const time=parts?parts.slice(1).map(value=>pad(Number(value||0))).join(':'):'';
   const date=picker.date.value.trim(),parsed=new Date(date+'T00:00:00Z');
   const validDate=/^20\d{2}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(parsed.getTime())&&dateText(parsed)===date;
   const validTime=/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time);
   picker.date.setAttribute('aria-invalid',String(!validDate));picker.time.setAttribute('aria-invalid',String(!validTime));
   if(!validDate||!validTime){const message=get('time-message');message.classList.add('input-error');message.textContent=!validDate?'请按 YYYY-MM-DD 填写2000–2099年内的有效日期。':'请填写有效时间（时0–23，分和秒0–59）。';return false;}
   source.value=date+'T'+time;return convertClockInput(prefix);
  }
  function chooseDate(value){picker.date.value=value;validateAndConvert();picker.view=new Date(value.slice(0,7)+'-01T00:00:00Z');renderCalendar();}
  function renderCalendar(){
   const year=picker.view.getUTCFullYear(),month=picker.view.getUTCMonth();picker.year.value=String(year);picker.month.value=String(month);
   panel.querySelector('[data-month-step="-1"]').disabled=year===2000&&month===0;
   panel.querySelector('[data-month-step="1"]').disabled=year===2099&&month===11;
   const grid=panel.querySelector('.time-calendar-days');grid.replaceChildren();
   const start=new Date(Date.UTC(year,month,1)),offset=(start.getUTCDay()+6)%7;start.setUTCDate(1-offset);
   for(let i=0;i<42;i++){
    const day=new Date(start);day.setUTCDate(start.getUTCDate()+i);const value=dateText(day),button=document.createElement('button');
    button.type='button';button.textContent=String(day.getUTCDate());button.setAttribute('aria-label',value);button.setAttribute('aria-pressed',String(value===picker.date.value));
    button.classList.toggle('outside-month',day.getUTCMonth()!==month);button.classList.toggle('is-today',value===today());
    if(value===today())button.setAttribute('aria-current','date');
    button.disabled=day.getUTCFullYear()<2000||day.getUTCFullYear()>2099;
    listen(button,'click',()=>chooseDate(value));grid.append(button);
   }
  }
  listen(controls,'focusin',()=>{if(isLive())source.dispatchEvent(new Event('focus'));});
  for(const input of [picker.date,picker.time]){
   listen(input,'blur',validateAndConvert);
   listen(input,'input',()=>{if(/^\d{4}-\d{2}-\d{2}$/.test(picker.date.value)&&/^\d{1,2}:\d{1,2}(?::\d{1,2})?$/.test(picker.time.value))validateAndConvert();});
   listen(input,'keydown',event=>{if(event.key==='Enter'){event.preventDefault();validateAndConvert();input.blur();}});
  }
  listen(picker.toggle,'click',()=>{
   if(opened===picker){close();return;}close();
   api.sync();const value=source.value.slice(0,7);picker.view=new Date(value+'-01T00:00:00Z');renderCalendar();
   opened=picker;panel.hidden=false;picker.toggle.setAttribute('aria-expanded','true');panel.scrollIntoView({block:'nearest'});
  });
  for(const button of panel.querySelectorAll('[data-month-step]'))listen(button,'click',()=>{picker.view.setUTCMonth(picker.view.getUTCMonth()+Number(button.dataset.monthStep));renderCalendar();});
  for(const select of [picker.year,picker.month])listen(select,'change',()=>{picker.view=new Date(Date.UTC(Number(picker.year.value),Number(picker.month.value),1));renderCalendar();});
  for(const input of picker.parts){
   const apply=()=>{for(const part of picker.parts)part.setAttribute('aria-invalid',String(!part.value||!part.validity.valid));picker.time.value=picker.parts.map(part=>part.value===''?'':pad(Number(part.value))).join(':');return validateAndConvert();};
   listen(input,'input',apply);listen(input,'change',()=>{if(apply())input.value=pad(Number(input.value));});
   listen(input,'keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(apply())close(true);}});
  }
  listen(panel.querySelector('.calendar-today'),'click',()=>chooseDate(today()));
  listen(panel.querySelector('.calendar-done'),'click',()=>{if(validateAndConvert())close(true);});
 }
 listen(document,'pointerdown',event=>{if(opened&&!opened.field.contains(event.target))close();});
 listen(document,'keydown',event=>{if(event.key==='Escape'&&opened){event.preventDefault();close(true);}});
 listen(get('toggle-time'),'click',()=>close());
 listen(get('time-now'),'click',()=>{for(const p of pickers){p.date.removeAttribute('aria-invalid');p.time.removeAttribute('aria-invalid');}close();});
 listen(get('zone-setting'),'change',()=>close());
 const api={sync(){for(const p of pickers){const [date,rawTime]=p.source.value.split('T'),time=rawTime?.length===5?rawTime+':00':rawTime;if((root.ownerDocument||root).activeElement!==p.date){p.date.value=date||'';p.date.removeAttribute('aria-invalid');}if((root.ownerDocument||root).activeElement!==p.time){p.time.value=time||'';p.time.removeAttribute('aria-invalid');}for(const [index,part]of p.parts.entries())if((root.ownerDocument||root).activeElement!==part){part.value=time?.split(':')[index]||'00';part.removeAttribute('aria-invalid');}}}};
 api.sync();
 return {sync:api.sync,destroy(){close();for(const remove of listeners)remove();for(const p of pickers){p.source.hidden=false;p.field.querySelector('label').htmlFor=p.source.id;p.field.querySelector('.time-picker-controls')?.remove();p.panel.remove();}}};
}
const api={mount};root.TimePickerFactory=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
