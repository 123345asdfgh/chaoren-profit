// Database-backed save and load actions; search is on /history.
const archiveFieldIds=['attribute','chinaPrice','salePrice','buyerShipping','receipt','logistics','currency',...settings.map(([key])=>key),'zone'];
const recordSettingIds=settings.map(([key])=>key);
const archiveMessage=(message,error=false)=>{const target=get('message');target.textContent=message;target.classList.toggle('error',error)};
const api='/api/profit';
let activeRecordId=null;
async function apiRequest(url,options={}){const response=await fetch(api+url,{headers:{'content-type':'application/json'},...options});const data=await response.json();if(!response.ok)throw Error(data.error||'请求失败');return data}
function validateSnapshot(snapshot){
 if(!snapshot||!snapshot.fields)throw Error('记录缺少测算参数');const fields=snapshot.fields;
 for(const id of archiveFieldIds){if(typeof fields[id]!=='string')throw Error('记录缺少字段：'+id);const input=get(id).cloneNode(true);input.value=fields[id];if(input.value!==fields[id]||!input.checkValidity())throw Error('记录字段无效：'+id)}
 const input={...Object.fromEntries(settings.map(([key])=>[key,Number(fields[key])])),chinaPrice:Number(fields.chinaPrice),salePrice:Number(fields.salePrice),buyerShipping:Number(fields.buyerShipping),receipt:Number(fields.receipt),logistics:Number(fields.logistics),currency:fields.currency};
 for(const key of ['chinaPrice','salePrice','buyerShipping','receipt','logistics',...settings.map(([key])=>key)])if(fields[key]==='')throw Error('必填参数为空：'+key);
 if(Math.abs(input.salePrice+input.buyerShipping-input.receipt)>Math.max(1e-8,input.receipt*1e-12))throw Error('实收金额不一致');DailyCore.calculate(input)
}
function activateRecordConfig(values,visible=true){
 const container=get('record-config-fields');container.replaceChildren();
 for(const [id,label,unit]of settings){
  const wrapper=document.createElement('div'),caption=document.createElement('label'),input=get(id).cloneNode(true);
  input.id='record-'+id;input.value=values[id]??get(id).value;caption.htmlFor=input.id;caption.textContent=`${label}（${unit}）`;wrapper.append(caption,input);container.append(wrapper);
  input.addEventListener('input',()=>{settingSummary();referencePrice();paintQuote();renderProfit()});
 }
 recordConfigActive=true;get('record-config-panel').hidden=!visible;
 settingSummary();referencePrice();paintQuote();renderProfit();
}
function restoreArchive(record){
 try{validateSnapshot(record.snapshot)}catch(error){archiveMessage('无法载入：'+error.message,true);return}
 activeRecordId=record.id;get('new-order').hidden=false;
 for(const id of archiveFieldIds)if(id!=='zone'&&!recordSettingIds.includes(id))get(id).value=record.snapshot.fields[id];get('store').value='广州店铺';previousCurrency=get('currency').value;adoptedQuote=null;autoSale=false;
 quoteInvalid('填写包裹信息后可计算物流成本。');activateRecordConfig(record.snapshot.fields);renderClocks();
 get('archive-name').value=record.name;get('archive-spec').value=record.specCode;get('archive-product').value=record.productCode;
 archiveMessage('已载入“'+record.name+'”。修改后保存会生成新版本，上一版可在历史记录页恢复。')
}
function snapshotForSave(changes={}){
 const fields=Object.fromEntries(archiveFieldIds.map(id=>[id,changes[id]??effectiveField(id).value]));
 const input={...Object.fromEntries(settings.map(([key])=>[key,Number(fields[key])])),chinaPrice:Number(fields.chinaPrice),salePrice:Number(fields.salePrice),buyerShipping:Number(fields.buyerShipping),receipt:Number(fields.receipt),logistics:Number(fields.logistics),currency:fields.currency};
 for(const key of ['chinaPrice','salePrice','buyerShipping','receipt','logistics'])if(fields[key]==='')throw Error('请补全新方案的成交与成本。');
 if(Math.abs(input.salePrice+input.buyerShipping-input.receipt)>Math.max(1e-8,input.receipt*1e-12))throw Error('商品售价、买家运费与实收不一致。');
 return {fields,input,result:DailyCore.calculate(input)};
}
async function saveProfit(changes={}){
 if(!get('save-product-form').checkValidity())throw Error('请填写完整产品信息。');
 const body={name:get('archive-name').value,specCode:get('archive-spec').value,productCode:get('archive-product').value,market:'US',snapshot:snapshotForSave(changes)};
 return apiRequest(activeRecordId?'/records/'+encodeURIComponent(activeRecordId):'/records',{method:activeRecordId?'PATCH':'POST',body:JSON.stringify(body)});
}
function showSaved(record){
 activeRecordId=record.id;
 if(recordConfigActive&&record.version>1)get('record-config-panel').hidden=false;
 archiveMessage('已保存到数据库 · 第'+record.version+'版。可在历史记录页查看。');
 get('save-success-message').textContent='“'+record.name+'”已保存为第'+record.version+'版。';get('save-success-dialog').hidden=false;get('close-save-success').focus();
}
get('open-save').addEventListener('click',()=>{renderProfit();if(!latest){archiveMessage('请先完成有效的利润测算',true);return}get('save-product-form').requestSubmit()});
get('save-product-form').addEventListener('submit',async event=>{event.preventDefault();const button=get('open-save');button.disabled=true;
 try{showSaved(await saveProfit());get('save-product-message').textContent=''}
 catch(error){get('save-product-message').textContent='保存失败：'+error.message}finally{button.disabled=false}
});
get('new-order').addEventListener('click',()=>{
 activeRecordId=null;get('new-order').hidden=true;
 recordConfigActive=false;get('record-config-panel').hidden=true;get('record-config-fields').replaceChildren();
 for(const id of ['archive-name','archive-spec','archive-product','length','width','height','weight'])get(id).value='';
 get('attribute').value='潮玩';get('store').value='广州店铺';get('packType').value='parcel';
 applyBusinessSettings(savedBusinessSettings);resetProfit();quoteInvalid('填写包裹信息后可计算物流成本。');
 const url=new URL(location.href);url.searchParams.delete('record');history.replaceState(null,'',url);
 get('save-product-message').textContent='';archiveMessage('已开始新测算。');get('archive-name').focus();
});
get('close-save-success').addEventListener('click',()=>{get('save-success-dialog').hidden=true;get('open-save').focus()});
get('save-success-dialog').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();get('close-save-success').click()}});
const currentId=new URLSearchParams(location.search).get('record');if(currentId)apiRequest('/records/'+encodeURIComponent(currentId)).then(record=>restoreArchive(record)).catch(error=>archiveMessage(error.message,true));
get('compare-current').addEventListener('click',()=>{
 renderProfit();if(!latest){archiveMessage('请先完成有效的利润测算',true);return}
 openComparison({name:get('archive-name').value.trim()||'当前测算',specCode:get('archive-spec').value.trim(),productCode:get('archive-product').value.trim(),savedAt:new Date().toISOString(),snapshot:{fields:Object.fromEntries(archiveFieldIds.map(id=>[id,effectiveField(id).value])),result:latest}});
});
