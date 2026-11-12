(function(global){
 const markup='<section class="time-strip restored-time" data-time-widget aria-label="中美时差换算"><div class="time-cell china"><div class="time-label"><span>北京时间</span><div class="clock-fx"><label for="fx" title="1美元对应人民币（RMB/💲）">结算汇率</label><input id="fx" type="number" min="0.000001" max="1000000000" step="any" value="6.8" aria-label="结算汇率，1美元对应人民币"></div></div><div class="clock" id="cn-clock">--:--:--</div><div class="clock-date" id="cn-date">—</div><div class="scene-caption" id="cn-phase" title="按当地时间切换的背景氛围，不代表实时天气">时段背景</div></div>\n<div class="time-center"><span class="time-status" id="time-status">● 实时同步</span><strong id="time-gap">—</strong><button id="toggle-time" aria-expanded="false" class="text-btn">换算其他时间 ↗</button></div>\n<div class="time-cell"><div class="time-label"><label for="zone-setting">美国时间</label><select id="zone-setting" aria-label="美国时间地区"><option value="America/Los_Angeles">洛杉矶 · 太平洋</option><option value="America/New_York">纽约 · 东部</option><option value="America/Chicago">芝加哥 · 中部</option><option value="America/Denver">丹佛 · 山地</option></select></div><div class="clock" id="us-clock">--:--:--</div><div class="clock-date" id="us-date">—</div><div class="scene-caption" id="us-phase" title="按当地时间切换的背景氛围，不代表实时天气">时段背景</div></div>\n<div class="time-edit" id="time-edit" hidden><div><label for="cn-time">北京日期与时间</label><input id="cn-time" type="datetime-local" step="1" min="2000-01-01T00:00" max="2099-12-31T23:59:59"></div><div><label for="us-time">美国日期与时间</label><input id="us-time" type="datetime-local" step="1" min="2000-01-01T00:00" max="2099-12-31T23:59:59"></div><button id="time-now">回到当前时间</button><div id="time-message" class="small" role="status"></div><div id="time-fold" hidden><label for="time-occurrence">夏令时重复时间，选择第几次</label><select id="time-occurrence"></select></div></div></section>';
 function mount(root,{core=global.TimeCore,onZone=()=>{}}={}){
  const TimeCore=core,get=id=>root.querySelector('#'+id),document=root.ownerDocument||root;
  const removers=[];let picker=null;
  const listen=(node,type,fn)=>{node.addEventListener(type,fn);removers.push(()=>node.removeEventListener(type,fn));};
const chinaZone='Asia/Shanghai';
const zoneNames={'America/Los_Angeles':'太平洋','America/Denver':'山地','America/Chicago':'中部','America/New_York':'东部'};
let clockTimestamp=Date.now(),clockLive=true,clockCandidates=[];
function renderClocks(){
 for(const [prefix,zone]of [['us',get('zone-setting').value],['cn',chinaZone]]){
  const local=TimeCore.local(clockTimestamp,zone);get(prefix+'-clock').textContent=local.slice(11);
  const phase=TimeCore.phase(clockTimestamp,zone);get(prefix+'-clock').closest('.time-cell').dataset.phase=phase;
  get(prefix+'-phase').textContent={morning:'上午 · 蓝天白云',noon:'正午 · 明亮日光',dusk:'黄昏 · 落日晚霞',night:'夜晚 · 静谧月色'}[phase];
  get(prefix+'-date').textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).format(clockTimestamp);
  if(document.activeElement!==get(prefix+'-time'))get(prefix+'-time').value=local;
 }
 picker?.sync();
 get('time-status').textContent=clockLive?'● 实时同步':'◷ 自定义时间';
 get('time-gap').textContent=`北京快 ${(TimeCore.offset(clockTimestamp,chinaZone)-TimeCore.offset(clockTimestamp,get('zone-setting').value))/60} 小时`;
}
listen(get('toggle-time'),'click',()=>{get('time-edit').hidden=!get('time-edit').hidden;get('toggle-time').setAttribute('aria-expanded',String(!get('time-edit').hidden));get('toggle-time').textContent=get('time-edit').hidden?'换算其他时间 ↗':'收起时间换算 ↑';});
function convertClockInput(prefix){
  const input=get(prefix+'-time');
  clockLive=false;get('time-fold').hidden=true;
  if(!input.value||!input.validity.valid){get('time-message').classList.add('input-error');get('time-message').textContent='请输入2000–2099年内的完整日期时间。';return false;}
  clockCandidates=TimeCore.resolve(input.value,prefix==='us'?get('zone-setting').value:chinaZone);
  if(!clockCandidates.length){get('time-message').classList.add('input-error');get('time-message').textContent='该时间因夏令时跳时不存在，请重新填写。';return false;}
  clockTimestamp=clockCandidates[0];get('time-message').classList.remove('input-error');get('time-message').textContent=clockCandidates.length>1?'夏令时结束，该时间有两次，默认第一次；可选择。':'';
  if(clockCandidates.length>1){get('time-occurrence').replaceChildren(...clockCandidates.map((value,index)=>new Option(`第${index+1}次 → 北京 ${TimeCore.local(value,chinaZone).replace('T',' ')}`,String(index))));get('time-fold').hidden=false;}
  renderClocks();
  return true;
}
for(const prefix of ['us','cn']){
 const input=get(prefix+'-time');listen(input,'focus',()=>{clockLive=false;renderClocks();});
 listen(input,'change',()=>convertClockInput(prefix));
}
listen(get('time-occurrence'),'change',()=>{clockTimestamp=clockCandidates[Number(get('time-occurrence').value)];renderClocks();});
listen(get('zone-setting'),'change',()=>{onZone(get('zone-setting').value);get('time-fold').hidden=true;get('time-message').textContent='';get('time-message').classList.remove('input-error');renderClocks();});
listen(get('time-now'),'click',()=>{clockLive=true;clockTimestamp=Date.now();get('time-fold').hidden=true;get('time-message').textContent='';get('time-message').classList.remove('input-error');renderClocks();});

  renderClocks();
  const factory=global.TimePickerFactory||(typeof require!=='undefined'?require('./time-picker.js'):null);
  picker=factory.mount({root,core,convertClockInput,isLive:()=>clockLive});
  const timer=setInterval(()=>{if(clockLive){clockTimestamp=Date.now();renderClocks();}},1000);
  return {render:renderClocks,convert:convertClockInput,get live(){return clockLive},destroy(){clearInterval(timer);picker.destroy();for(const remove of removers)remove();}};
 }
 const api={markup,mount};global.TimeWidget=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
