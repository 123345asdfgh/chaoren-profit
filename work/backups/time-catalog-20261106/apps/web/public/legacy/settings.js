// Personal defaults and the active measurement are independent configurations.
const businessSettingIds=settings.map(([key])=>key);
const defaultZone='America/Los_Angeles';
let savedBusinessSettings={...Object.fromEntries(businessSettingIds.map(id=>[id,String(DEFAULTS[id])])),zone:defaultZone};
let savedFreightSettings=FreightCore.cloneConfig(FreightCore.DEFAULT_CONFIG);
let measurementTouched=false;
const defaultEdits=new Map();
function clearDefaultEdits(){defaultEdits.clear();}
function defaultFieldsForSave(){
 return Object.fromEntries([...defaultEdits].filter(([id,value])=>value!==''&&(id==='zone'||get(id).checkValidity())));
}
let savingDefaults=false;
async function saveMyDefaults(){
 if(savingDefaults)return;
 const button=get('save-default-settings');
 const message=get('settings-message');
 try{
  await defaultsReady;
  const fields=readBusinessSettings();
  for(const id of businessSettingIds){
   if(fields[id]===''||!get(id).checkValidity())throw Error('请先填写有效的测算配置。');
  }
  if(!fields.zone||!zoneNames[fields.zone])throw Error('请选择有效的美国时间地区。');
  savingDefaults=true;button.disabled=true;message.classList.remove('error');message.textContent='正在保存默认配置…';
  const response=await fetch('/api/profit/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({fields})});
  const body=await response.json();if(!response.ok)throw Error(body.error||'默认配置保存失败');
  if(body?.fields)savedBusinessSettings={...savedBusinessSettings,...body.fields};
  clearDefaultEdits();message.textContent='已设为我的默认配置，之后重开一单会使用这组参数。';
 }catch(error){message.textContent=error.message;message.classList.add('error')}
 finally{savingDefaults=false;button.disabled=false}
}
function rememberSavedDefaults(defaults,submitted){
 if(!defaults?.fields)return;
 savedBusinessSettings={...savedBusinessSettings,...defaults.fields};
 for(const [id,value]of Object.entries(submitted))if(defaultEdits.get(id)===value)defaultEdits.delete(id);
}
function readBusinessSettings(){return {...Object.fromEntries(businessSettingIds.map(id=>[id,get(id).value])),zone:get('zone').value};}
function applyBusinessSettings(values){
 for(const id of businessSettingIds)if(values[id]!==undefined)get(id).value=String(values[id]);
 get('zone-setting').value=values.zone&&zoneNames[values.zone]?values.zone:defaultZone;
 get('zone').value=get('zone-setting').value;
 settingSummary();referencePrice();renderProfit();renderClocks();
}
for(const input of document.querySelectorAll('main input,main select'))input.addEventListener('input',()=>{measurementTouched=true});
for(const id of businessSettingIds)get(id).addEventListener('input',()=>defaultEdits.set(id,get(id).value));
get('zone-setting').addEventListener('change',()=>{measurementTouched=true;get('zone').value=get('zone-setting').value;defaultEdits.set('zone',get('zone').value);renderClocks()});
get('save-default-settings').addEventListener('click',()=>{void saveMyDefaults()});
const defaultsReady=fetch('/api/profit/settings').then(async response=>{
 const body=await response.json();if(!response.ok)throw Error(body.error||'读取默认参数失败');return body;
}).then(body=>{
 if(body?.fields)savedBusinessSettings={...savedBusinessSettings,...body.fields};
 if(body?.freight)savedFreightSettings=FreightCore.cloneConfig(body.freight);
 // A quick product entry must not keep the built-in rates while personal
 // defaults are loading. Preserve only settings the user actually edited.
 applyBusinessSettings({...savedBusinessSettings,...Object.fromEntries(defaultEdits)});updateFreightQuote();
}).catch(()=>{get('settings-message').textContent='默认参数读取失败，当前使用内置默认值；请核对后保存。';get('settings-message').classList.add('error')});
