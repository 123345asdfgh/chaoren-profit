// Catalog edits, new orders and history edits have distinct persistence targets.
const shippingFieldIds=['length','width','height','weight','packType','store'];
const archiveFieldIds=['photoId','attribute','chinaPrice','salePrice','buyerShipping','receipt','logistics','currency',...settings.map(([key])=>key),'zone',...shippingFieldIds];
const api='/api/profit';
const archiveMessage=(message,error=false)=>{const target=get('message');target.textContent=message;target.classList.toggle('error',error)};
let activeRecordId=null,activeProductId=null,measurementMode='new',savingMeasurement=false;
// 这是当前商品在历史记录中的测算序号：新建空白单没有序号，
// 搜索已有商品或载入历史记录后才显示，避免把“商品资料修改”误认为新单。
let measurementSequence=null;
async function apiRequest(url,options={}){
 const headers={...(options.body==null?{}:{'content-type':'application/json'}),...options.headers};
 const response=await fetch(api+url,{...options,headers});
 const data=await response.json();if(!response.ok)throw Error(data.error||'请求失败');return data;
}
function validateSnapshot(snapshot){
 if(!snapshot||!snapshot.fields)throw Error('记录缺少测算参数');
 for(const id of archiveFieldIds){
  const value=snapshot.fields[id];if(value===undefined||value==='')continue;
  if(typeof value!=='string')throw Error('记录字段无效：'+id);
  const expected=id==='attribute'?FreightCore.normalizeCategory(value):value;
  const input=get(id).cloneNode(true);input.value=expected;
  if(input.value!==expected||!input.checkValidity())throw Error('记录字段无效：'+id);
 }
}
function renderMeasurementMode(){
 const label=measurementMode==='product'
  ?'修改商品资料 · 仅更新商品表'
  :activeRecordId
   ?(measurementMode==='history'?`第 ${measurementSequence||1} 次测算 · 修改中`:`第 ${measurementSequence||1} 次测算`)
   :activeProductId
    ?`第 ${measurementSequence||2} 次测算`
    :'本单初次创建';
 get('measurement-mode').textContent=label;
 get('open-save').textContent=measurementMode==='product'?'保存商品修改':activeRecordId?'保存修改':'保存测算';
 get('new-order').hidden=!activeRecordId&&!activeProductId;
}
function applyMeasurementFields(fields,freight=savedFreightSettings){
 clearDefaultEdits();
 const photoId=fields.photoId??get('photoId').value;
 window.ProductPhoto?.reset();get('photoId').value=photoId;
 autoSale=false;
 for(const id of archiveFieldIds)if(fields[id]!==undefined)get(id).value=id==='attribute'?FreightCore.normalizeCategory(fields[id]):fields[id];
 window.ProductPhoto?.render();
 previousCurrency=get('currency').value;recordFreightSettings=FreightCore.cloneConfig(freight);
 get('zone-setting').value=get('zone').value;
 settingSummary();referencePrice();updateFreightQuote();renderProfit();renderClocks();
}
function clearRecordUrl(){const url=new URL(location.href);url.searchParams.delete('record');url.searchParams.delete('product');history.replaceState(null,'',url);}
function beginNewMeasurement(focus=true){
 clearDefaultEdits();
 window.ProductPhoto?.reset();
 activeRecordId=activeProductId=null;measurementMode='new';measurementSequence=null;recordFreightSettings=null;measurementTouched=true;
 for(const id of ['archive-name','archive-spec','archive-product','length','width','height','weight','product-search'])get(id).value='';
 get('attribute').value='';get('store').value='广州店铺';get('packType').value='parcel';
 autoSale=true;applyBusinessSettings(savedBusinessSettings);resetProfit();quoteInvalid();clearRecordUrl();
 get('save-product-message').textContent='';get('product-name-hint').textContent='';renderMeasurementMode();
 if(focus)get('archive-name').focus();
}
async function loadProductMeasurement(product,mode='new'){
 if(product.snapshot)validateSnapshot(product.snapshot);
 beginNewMeasurement(false);activeProductId=product.id;measurementMode=mode;
 if(product.snapshot)applyMeasurementFields(product.snapshot.fields,product.snapshot.freight||savedFreightSettings);
 get('archive-name').value=product.name;get('archive-spec').value=product.specCode;get('archive-product').value=product.productCode;get('attribute').value=FreightCore.normalizeCategory(product.attribute);
 for(const key of ['length','width','height','weight'])get(key).value=product[key]==null?'':String(product[key]);
 get('product-search').value=product.specCode;updateFreightQuote();renderProfit();
 if(mode==='new'){
  // 商品搜索后的首次保存是该商品的新单，序号取历史记录数 + 1。
  // 查询失败时保留一个可理解的兜底文案，不影响保存流程。
  measurementSequence=null;renderMeasurementMode();
  try{
   const history=await apiRequest('/products/'+encodeURIComponent(product.id)+'/history');
   measurementSequence=(Array.isArray(history.records)?history.records.length:0)+1;
  }catch{}
 }
 renderMeasurementMode();
 if(mode==='product'){
  const url=new URL(location.href);url.searchParams.set('product',product.id);history.replaceState(null,'',url);
  archiveMessage('正在修改商品资料，保存仅更新商品表中的数据和配置。');
 }
}
function restoreArchive(record){
 try{
  validateSnapshot(record.snapshot);beginNewMeasurement(false);
  activeRecordId=record.id;activeProductId=record.productId;measurementMode='history';measurementSequence=record.version||1;
  applyMeasurementFields(record.snapshot.fields,record.snapshot.freight||savedFreightSettings);
  get('archive-name').value=record.name;get('archive-spec').value=record.specCode;get('archive-product').value=record.productCode;get('product-search').value=record.specCode;
  const url=new URL(location.href);url.searchParams.set('record',record.id);history.replaceState(null,'',url);
  renderMeasurementMode();archiveMessage('已载入第'+record.version+'版。保存将修改原历史记录并同步商品资料。');
 }catch(error){archiveMessage('无法载入：'+error.message,true)}
}
function snapshotForSave(changes={},freight){
 const fields=Object.fromEntries(archiveFieldIds.map(id=>[id,changes[id]??get(id).value]));
 for(const id of archiveFieldIds){
  const original=get(id),input=original.cloneNode(true);input.value=fields[id];
  if((changes[id]===undefined&&!original.checkValidity())||input.value!==fields[id]||!input.checkValidity())throw Error('请检查'+(document.querySelector(`label[for="${id}"]`)?.textContent||id));
 }
 const numeric=['chinaPrice','salePrice','buyerShipping','receipt','logistics',...settings.map(([key])=>key)];
 let input=null,result=null;
 if(numeric.every(key=>fields[key]!=='')&&fields.currency){
  input={...Object.fromEntries(numeric.map(key=>[key,Number(fields[key])])),currency:fields.currency};
  if(Math.abs(input.salePrice+input.buyerShipping-input.receipt)>Math.max(1e-8,input.receipt*1e-12))throw Error('最终实收与商品售价、买家运费不一致，请修改实收或售价。');
  result=DailyCore.calculate(input);
 }
 return {fields,input,result,freight:FreightCore.cloneConfig(freight||effectiveFreightConfig())};
}
async function saveProfit(changes={},freight,{updateDefaults=false}={}){
 if(savingMeasurement)throw Error('正在保存，请稍候。');
 savingMeasurement=true;
 try{
 await defaultsReady;
 await window.ProductPhoto?.ready();
 if(!get('archive-spec').value.trim())throw Error('请填写规格编码。');
 if(!get('save-product-form').checkValidity())throw Error('请检查填写的产品信息。');
 const body={name:get('archive-name').value.trim(),specCode:get('archive-spec').value.trim(),productCode:get('archive-product').value.trim(),productId:activeProductId,market:'US',snapshot:snapshotForSave(changes,freight)};
 // Default configuration changes are explicit: only the settings button writes them.
 const defaultFields=null;
 if(defaultFields!==null)body.defaultFields=defaultFields;
 let saved;
 if(measurementMode==='product'){
  if(!activeProductId)throw Error('请重新从商品表选择要修改的商品。');
  saved=await apiRequest('/products/'+encodeURIComponent(activeProductId)+'/measurement',{method:'PUT',body:JSON.stringify(body)});
 }else{
  saved=await apiRequest(activeRecordId?'/records/'+encodeURIComponent(activeRecordId):'/records',{method:activeRecordId?'PATCH':'POST',body:JSON.stringify(body)});
 }
 if(defaultFields!==null)rememberSavedDefaults(saved.defaults,defaultFields);
 return saved;
 }finally{savingMeasurement=false}
}
function showSaved(record){
 if(record.saveTarget==='product'){
  activeRecordId=null;activeProductId=record.productId;measurementMode='product';measurementSequence=null;
  archiveMessage('商品资料与测算配置已更新。');
  get('save-success-message').textContent='“'+(record.name||record.specCode)+'”的商品资料、测算数据和配置已更新，本次仅保存到商品表。';
 }else{
  activeRecordId=record.id;activeProductId=record.productId;measurementMode='saved';measurementSequence=record.version||measurementSequence||1;
  archiveMessage('已保存第'+record.version+'版，并同步商品资料。');
  get('save-success-message').textContent='“'+(record.name||record.specCode)+'”的测算记录与商品资料已保存。当前为第'+record.version+'版；同商品开新单请点击“重开一单”后搜索。';
 }
 get('save-success-dialog').querySelector('a[href="/history"]').hidden=record.saveTarget==='product';
 renderMeasurementMode();
 get('save-success-dialog').hidden=false;get('close-save-success').focus();
}
get('open-save').addEventListener('click',()=>get('save-product-form').requestSubmit());
get('save-product-form').addEventListener('submit',async event=>{
 event.preventDefault();if(savingMeasurement)return;const button=get('open-save');button.disabled=true;
 try{renderProfit();showSaved(await saveProfit());get('save-product-message').textContent=''}
 catch(error){get('save-product-message').textContent='保存失败：'+error.message}finally{button.disabled=false}
});
get('new-order').addEventListener('click',()=>{beginNewMeasurement();archiveMessage('已开始新测算，保存时新增历史记录。');});
get('close-save-success').addEventListener('click',()=>{get('save-success-dialog').hidden=true;get('open-save').focus()});
get('save-success-dialog').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();get('close-save-success').click()}});
const currentId=new URLSearchParams(location.search).get('record');
const currentProductId=new URLSearchParams(location.search).get('product');
if(currentId)defaultsReady.then(()=>apiRequest('/records/'+encodeURIComponent(currentId))).then(restoreArchive).catch(error=>archiveMessage(error.message,true));
else if(currentProductId)defaultsReady.then(()=>apiRequest('/products/'+encodeURIComponent(currentProductId))).then(product=>loadProductMeasurement(product,'product')).catch(error=>archiveMessage(error.message,true));
renderMeasurementMode();
get('compare-current').addEventListener('click',async()=>{
 await defaultsReady;
 renderProfit();if(!latest){archiveMessage('请先完成有效的利润测算',true);return}
 try{openComparison({name:get('archive-name').value.trim()||'当前测算',specCode:get('archive-spec').value.trim(),productCode:get('archive-product').value.trim(),savedAt:new Date().toISOString(),snapshot:snapshotForSave()})}
 catch(error){archiveMessage(error.message,true)}
});
