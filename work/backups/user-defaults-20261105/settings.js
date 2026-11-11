// Business settings belong to the current measurement; freight rules remain internal.
const businessSettingIds=settings.map(([key])=>key);
const defaultZone='America/Los_Angeles';
let savedBusinessSettings={...Object.fromEntries(businessSettingIds.map(id=>[id,String(DEFAULTS[id])])),zone:defaultZone};
let savedFreightSettings=FreightCore.cloneConfig(FreightCore.DEFAULT_CONFIG);
let measurementTouched=false;
function readBusinessSettings(){return {...Object.fromEntries(businessSettingIds.map(id=>[id,get(id).value])),zone:get('zone').value};}
function applyBusinessSettings(values){
 for(const id of businessSettingIds)if(values[id]!==undefined)get(id).value=String(values[id]);
 get('zone-setting').value=values.zone&&zoneNames[values.zone]?values.zone:defaultZone;
 get('zone').value=get('zone-setting').value;
 settingSummary();referencePrice();renderProfit();renderClocks();
}
for(const input of document.querySelectorAll('main input,main select'))input.addEventListener('input',()=>{measurementTouched=true});
get('zone-setting').addEventListener('change',()=>{get('zone').value=get('zone-setting').value;renderClocks()});
const defaultsReady=fetch('/api/profit/settings').then(async response=>{
 const body=await response.json();if(!response.ok)throw Error(body.error||'读取默认参数失败');return body;
}).then(body=>{
 if(body?.fields)savedBusinessSettings={...savedBusinessSettings,...body.fields};
 if(body?.freight)savedFreightSettings=FreightCore.cloneConfig(body.freight);
 if(!measurementTouched){applyBusinessSettings(savedBusinessSettings);updateFreightQuote();}
}).catch(()=>{get('settings-message').textContent='默认参数读取失败，当前使用内置默认值；请核对后保存。';get('settings-message').classList.add('error')});
