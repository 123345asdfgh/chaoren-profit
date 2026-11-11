// The original calculator owns the formula inputs; this module only persists their settings.
const businessSettingIds=settings.map(([key])=>key);
const settingsDialog=get('settings-dialog');
const settingsMessage=get('settings-message');
const defaultZone='America/Los_Angeles';
let savedBusinessSettings={...Object.fromEntries(businessSettingIds.map(id=>[id,String(DEFAULTS[id])])),zone:defaultZone};
let settingsBeforeOpen=null;
let settingsWasSaved=false;
const freightEditor=get('freight-config-editor');
renderFreightEditor(freightEditor,savedFreightSettings,()=>{});
function readBusinessSettings(){return {...Object.fromEntries(businessSettingIds.map(id=>[id,get(id).value])),zone:get('zone-setting').value};}
function applyBusinessSettings(values){
 for(const id of businessSettingIds)if(values[id]!==undefined)get(id).value=String(values[id]);
 get('zone-setting').value=values.zone&&zoneNames[values.zone]?values.zone:defaultZone;
 get('zone').value=get('zone-setting').value;
 settingSummary();referencePrice();renderProfit();renderClocks();
}
get('zone-setting').addEventListener('change',()=>{get('zone').value=get('zone-setting').value;renderClocks()});
function settingsError(message){settingsMessage.textContent=message;settingsMessage.classList.add('error');}
get('open-settings').addEventListener('click',()=>{
 settingsBeforeOpen=readBusinessSettings();settingsWasSaved=false;settingsMessage.textContent='';settingsMessage.classList.remove('error');
 renderFreightEditor(freightEditor,savedFreightSettings,()=>{});
 settingsDialog.showModal();get('fx').focus();
});
get('close-settings').addEventListener('click',()=>settingsDialog.close());
settingsDialog.addEventListener('close',()=>{
 if(!settingsWasSaved&&settingsBeforeOpen)applyBusinessSettings(settingsBeforeOpen);
 settingsBeforeOpen=null;
});
get('reset-settings').addEventListener('click',()=>{
 applyBusinessSettings({...DEFAULTS,zone:defaultZone});renderFreightEditor(freightEditor,FreightCore.DEFAULT_CONFIG,()=>{});settingsMessage.classList.remove('error');
 settingsMessage.textContent='已回填全部默认值；点击“保存配置”后生效。';
});
get('settings-form').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!get('settings-form').reportValidity())return;
 const fields=readBusinessSettings();
 let freight;try{freight=readFreightEditor(freightEditor)}catch(error){settingsError(error.message);return}
 const submit=get('settings-form').querySelector('[type="submit"]');submit.disabled=true;
 try{
  const response=await fetch('/api/profit/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({fields,freight})});
  const body=await response.json();
  if(!response.ok)throw Error(body.error||'保存失败');
  savedBusinessSettings=fields;savedFreightSettings=FreightCore.cloneConfig(freight);updateFreightQuote(!recordConfigActive);renderProfit();settingsWasSaved=true;
  settingsMessage.classList.remove('error');settingsMessage.textContent='配置已保存到数据库。';
  settingsDialog.close();
 }catch(error){settingsError(error.message)}finally{submit.disabled=false}
});
fetch('/api/profit/settings').then(async response=>{
 const body=await response.json();if(!response.ok)throw Error(body.error||'读取配置失败');return body;
}).then(body=>{if(body?.fields){savedBusinessSettings={...savedBusinessSettings,...body.fields};if(body.freight)savedFreightSettings=FreightCore.cloneConfig(body.freight);if(!settingsDialog.open){applyBusinessSettings(savedBusinessSettings);updateFreightQuote()}}}).catch(error=>settingsError(error.message));
