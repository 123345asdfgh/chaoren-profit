// A catalog search starts a new order; only a saved record id updates an existing order.
const shippingFieldIds=['length','width','height','weight','packType','store'];
const archiveFieldIds=['attribute','chinaPrice','salePrice','buyerShipping','receipt','logistics','currency',...settings.map(([key])=>key),'zone',...shippingFieldIds];
const api='/api/profit';
const archiveMessage=(message,error=false)=>{const target=get('message');target.textContent=message;target.classList.toggle('error',error)};
let activeRecordId=null,activeProductId=null,measurementMode='new',savingMeasurement=false;
async function apiRequest(url,options={}){
 const response=await fetch(api+url,{headers:{'content-type':'application/json'},...options});
 const data=await response.json();if(!response.ok)throw Error(data.error||'请求失败');return data;
}
function validateSnapshot(snapshot){
 if(!snapshot||!snapshot.fields)throw Error('记录缺少测算参数');const fields=snapshot.fields;
 for(const id of archiveFieldIds){
  if(shippingFieldIds.includes(id)&&(fields[id]===undefined||fields[id]===''))continue;
  if(typeof fields[id]!=='string')throw Error('记录缺少字段：'+id);
  const input=get(id).cloneNode(true);input.value=fields[id];if(input.value!==fields[id]||!input.checkValidity())throw Error('记录字段无效：'+id);
 }
 const input={...Object.fromEntries(settings.map(([key])=>[key,Number(fields[key])])),chinaPrice:Number(fields.chinaPrice),salePrice:Number(fields.salePrice),buyerShipping:Number(fields.buyerShipping),receipt:Number(fields.receipt),logistics:Number(fields.logistics),currency:fields.currency};
 for(const key of ['chinaPrice','salePrice','buyerShipping','receipt','logistics',...settings.map(([key])=>key)])if(fields[key]==='')throw Error('必填参数为空：'+key);
 DailyCore.calculate(input);
}
function renderMeasurementMode(){
 get('measurement-mode').textContent=activeRecordId?(measurementMode==='history'?'修改历史记录':'当前测算已保存'):'新增测算'+(activeProductId?' · 已有商品':' · 新商品');
 get('open-save').textContent=activeRecordId?'保存修改':'保存测算';
 get('new-order').hidden=!activeRecordId&&!activeProductId;
}
function applyMeasurementFields(fields,freight=savedFreightSettings){
 autoSale=false;
 for(const id of archiveFieldIds)if(fields[id]!==undefined)get(id).value=fields[id];
 previousCurrency=get('currency').value;recordFreightSettings=FreightCore.cloneConfig(freight);
 get('zone-setting').value=get('zone').value;
 settingSummary();referencePrice();updateFreightQuote();renderProfit();renderClocks();
}
function clearRecordUrl(){const url=new URL(location.href);url.searchParams.delete('record');history.replaceState(null,'',url);}
function beginNewMeasurement(focus=true){
 activeRecordId=activeProductId=null;measurementMode='new';recordFreightSettings=null;measurementTouched=true;
 for(const id of ['archive-name','archive-spec','archive-product','length','width','height','weight','product-search'])get(id).value='';
 get('attribute').value='';get('store').value='广州店铺';get('packType').value='parcel';
 autoSale=true;applyBusinessSettings(savedBusinessSettings);resetProfit();quoteInvalid();clearRecordUrl();
 get('save-product-message').textContent='';get('product-name-hint').textContent='';renderMeasurementMode();
 if(focus)get('archive-name').focus();
}
function loadProductMeasurement(product){
 beginNewMeasurement(false);activeProductId=product.id;
 if(product.snapshot){validateSnapshot(product.snapshot);applyMeasurementFields(product.snapshot.fields,product.snapshot.freight||savedFreightSettings);}
 get('archive-name').value=product.name;get('archive-spec').value=product.specCode;get('archive-product').value=product.productCode;get('attribute').value=product.attribute;
 for(const key of ['length','width','height','weight'])get(key).value=String(product[key]);
 get('product-search').value=product.specCode;updateFreightQuote();renderProfit();renderMeasurementMode();
}
function restoreArchive(record){
 try{
  validateSnapshot(record.snapshot);beginNewMeasurement(false);
  activeRecordId=record.id;activeProductId=record.productId;measurementMode='history';
  applyMeasurementFields(record.snapshot.fields,record.snapshot.freight||savedFreightSettings);
  get('archive-name').value=record.name;get('archive-spec').value=record.specCode;get('archive-product').value=record.productCode;get('product-search').value=record.specCode;
  const url=new URL(location.href);url.searchParams.set('record',record.id);history.replaceState(null,'',url);
  renderMeasurementMode();archiveMessage('已载入第'+record.version+'版。保存将修改原历史记录并同步商品资料。');
 }catch(error){archiveMessage('无法载入：'+error.message,true)}
}
function snapshotForSave(changes={},freight){
 const fields=Object.fromEntries(archiveFieldIds.map(id=>[id,changes[id]??get(id).value]));
 const input={...Object.fromEntries(settings.map(([key])=>[key,Number(fields[key])])),chinaPrice:Number(fields.chinaPrice),salePrice:Number(fields.salePrice),buyerShipping:Number(fields.buyerShipping),receipt:Number(fields.receipt),logistics:Number(fields.logistics),currency:fields.currency};
 for(const key of ['chinaPrice','salePrice','buyerShipping','receipt','logistics',...settings.map(([key])=>key)])if(fields[key]==='')throw Error('请补全测算数据与配置。');
 for(const id of shippingFieldIds){const input=get(id).cloneNode(true);input.value=fields[id];if(!fields[id]||input.value!==fields[id]||!input.checkValidity())throw Error('请检查'+(document.querySelector(`label[for="${id}"]`)?.textContent||id));}
 const freightConfig=freight||effectiveFreightConfig();
 return {fields,input,result:DailyCore.calculate(input),freight:FreightCore.cloneConfig(freightConfig)};
}
async function saveProfit(changes={},freight){
 if(savingMeasurement)throw Error('正在保存，请稍候。');
 savingMeasurement=true;
 try{
 await defaultsReady;
 if(!get('save-product-form').checkValidity())throw Error('请填写完整产品信息。');
 if(!get('archive-name').value.trim()||!get('archive-spec').value.trim()||!get('archive-product').value.trim()||!get('attribute').value)throw Error('请填写商品名称、规格编码、商品编码和商品属性。');
 const body={name:get('archive-name').value.trim(),specCode:get('archive-spec').value.trim(),productCode:get('archive-product').value.trim(),productId:activeProductId,market:'US',snapshot:snapshotForSave(changes,freight)};
 return await apiRequest(activeRecordId?'/records/'+encodeURIComponent(activeRecordId):'/records',{method:activeRecordId?'PATCH':'POST',body:JSON.stringify(body)});
 }finally{savingMeasurement=false}
}
function showSaved(record){
 activeRecordId=record.id;activeProductId=record.productId;measurementMode='saved';renderMeasurementMode();
 archiveMessage('已保存第'+record.version+'版，并同步商品资料。');
 get('save-success-message').textContent='“'+record.name+'”的测算记录与商品资料已保存。当前为第'+record.version+'版；同商品开新单请点击“重开一单”后搜索。';
 get('save-success-dialog').hidden=false;get('close-save-success').focus();
}
get('open-save').addEventListener('click',()=>get('save-product-form').requestSubmit());
get('save-product-form').addEventListener('submit',async event=>{
 event.preventDefault();if(savingMeasurement)return;const button=get('open-save');button.disabled=true;
 try{renderProfit();if(!latest)throw Error('请先完成有效的利润测算。');showSaved(await saveProfit());get('save-product-message').textContent=''}
 catch(error){get('save-product-message').textContent='保存失败：'+error.message}finally{button.disabled=false}
});
get('new-order').addEventListener('click',()=>{beginNewMeasurement();archiveMessage('已开始新测算，保存时新增历史记录。');});
get('close-save-success').addEventListener('click',()=>{get('save-success-dialog').hidden=true;get('open-save').focus()});
get('save-success-dialog').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();get('close-save-success').click()}});
const currentId=new URLSearchParams(location.search).get('record');
if(currentId)defaultsReady.then(()=>apiRequest('/records/'+encodeURIComponent(currentId))).then(restoreArchive).catch(error=>archiveMessage(error.message,true));
renderMeasurementMode();
get('compare-current').addEventListener('click',()=>{
 renderProfit();if(!latest){archiveMessage('请先完成有效的利润测算',true);return}
 try{openComparison({name:get('archive-name').value.trim()||'当前测算',specCode:get('archive-spec').value.trim(),productCode:get('archive-product').value.trim(),savedAt:new Date().toISOString(),snapshot:snapshotForSave()})}
 catch(error){archiveMessage(error.message,true)}
});
