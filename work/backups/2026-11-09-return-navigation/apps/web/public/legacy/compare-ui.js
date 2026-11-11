const compareGet=id=>get('compare-'+id);
const compareGroups=[['新方案成交与成本',['chinaPrice','salePrice','buyerShipping','receipt','logistics','currency']]];
const compareFreightIds=['length','width','height','weight','packType','store'];
let compareRecord=null,compareResult=null,compareQuote=null,compareFreightError='',compareCurrency='RMB',compareReturnFocus=null,compareAutoSale=false,compareFreightSettings=null;
function compareLabel(id){return document.querySelector(`label[for="${id}"]`)?.textContent||({currency:'物流币种'}[id]||id);}
function compareNumber(id){const input=compareGet(id);if(!input.value||!input.checkValidity()||!Number.isFinite(Number(input.value)))throw Error('请填写有效的'+compareLabel(id));return Number(input.value);}
function compareInput(){
 const salePrice=compareNumber('salePrice'),buyerShipping=compareNumber('buyerShipping'),receipt=compareNumber('receipt');
 if(Math.abs(salePrice+buyerShipping-receipt)>Math.max(1e-8,receipt*1e-12))throw Error('最终实收与商品售价、买家运费不一致。');
 return {...Object.fromEntries(settings.map(([key])=>[key,compareNumber(key)])),chinaPrice:compareNumber('chinaPrice'),salePrice,buyerShipping,receipt,logistics:compareNumber('logistics'),currency:compareGet('currency').value};
}
function comparePercent(value){return value===null?'不适用':(value*100).toFixed(2)+'%';}
function compareAmount(value,currency){return value===null?'—':money(value,currency);}
function compareSigned(value,currency){return value===null?'—':(value>0?'+':'')+money(value,currency);}
function paintCompareValue(element,value){
 element.classList.remove('value-positive','value-negative','value-neutral');
 element.classList.add(CompareCore.valueClass(value));
}
function appendComparePair(element,rmb,usd,signed=false){
 const format=signed?compareSigned:compareAmount;
 const rmbValue=document.createElement('span'),usdValue=document.createElement('span');
 rmbValue.textContent=format(rmb,'RMB');usdValue.textContent=format(usd,'USD');
 paintCompareValue(rmbValue,rmb);paintCompareValue(usdValue,usd);
 element.replaceChildren(rmbValue,document.createTextNode(' / '),usdValue);
}
function renderCompare(){
 if(!compareRecord)return;
 let error='';compareResult=null;
 try{compareResult=DailyCore.calculate(compareInput());}catch(problem){error=problem.message;}
 const before=compareRecord.snapshot.result,after=compareResult||DailyCore.preview(readProfitPreviewInput('compare-')),oldFx=Number(compareRecord.snapshot.fields.fx);
 document.querySelector('label[for="compare-logistics"]').textContent='实际物流成本（'+(compareGet('currency').value==='RMB'?'RMB':'💲')+'）';
 compareGet('logistics-source').textContent=compareFreightError?compareFreightError+' 请手动填写实际物流成本。':'点击“采用物流估算”填入，或自行填写实际成本。';
 compareGet('logistics-source').classList.toggle('input-error',!!compareFreightError);
 compareGet('new-rate').textContent=after.netUsd===null?'—':comparePercent(after.margin);
 compareGet('new-money').textContent=`${compareAmount(after.netRmb,'RMB')} / ${compareAmount(after.netUsd)}`;
 const delta=after?CompareCore.marginDelta(before.margin,after.margin):null;
 compareGet('delta-rate').textContent=after?CompareCore.formatMarginDelta(before.margin,after.margin):'—';
 appendComparePair(compareGet('delta-money'),after.netRmb===null?null:after.netRmb-before.netRmb,after.netUsd===null?null:after.netUsd-before.netUsd,true);
 paintCompareValue(compareGet('old-rate'),before.margin);
 paintCompareValue(compareGet('old-money'),before.netRmb);
 paintCompareValue(compareGet('new-rate'),after?.margin??null);
 paintCompareValue(compareGet('new-money'),after?.netRmb??null);
 paintCompareValue(compareGet('delta-rate'),delta);
 compareGet('message').textContent=error||(after.margin===null?'新方案零营业收入，利润率不适用。':after.netUsd<0?'新方案亏损，所得税按0计算。':'');
 const missing=['chinaPrice','salePrice','buyerShipping','receipt','logistics',...settings.map(([key])=>key)].some(id=>compareGet(id).value==='');
 if(missing)compareGet('message').textContent='未填项及受影响的结果显示为 —，其他明细继续计算。';
 compareGet('message').classList.toggle('error',!!error&&!missing);
 const rows=CompareCore.rows(before,after,oldFx,readProfitPreviewInput('compare-').fx);
 const body=compareGet('breakdown');body.replaceChildren();
 for(const row of rows){
  const tr=document.createElement('tr');if(row.label==='净利润')tr.className='total';
  const label=document.createElement('td'),oldValue=document.createElement('td'),newValue=document.createElement('td'),deltaValue=document.createElement('td');
  label.textContent=row.label;
  oldValue.textContent=`${money(row.oldRmb,'RMB')} / ${money(row.oldUsd)}`;
  newValue.textContent=`${compareAmount(row.newRmb,'RMB')} / ${compareAmount(row.newUsd)}`;
  if(['税前利润','净利润'].includes(row.label)){
   paintCompareValue(oldValue,row.oldRmb);paintCompareValue(newValue,row.newRmb);
  }
  appendComparePair(deltaValue,row.deltaRmb,row.deltaUsd,true);
  tr.append(label,oldValue,newValue,deltaValue);body.append(tr);
 }
}
function createCompareFields(fields){
 const container=compareGet('fields');container.replaceChildren();
 compareGroups.forEach(([title,ids],groupIndex)=>{
  const section=document.createElement('section');section.className='compare-input-section';
  const heading=document.createElement('h3');heading.textContent=title;section.append(heading);
  const grid=document.createElement('div');grid.className='compare-fields';
  for(const id of ids){
   const wrapper=document.createElement('div'),label=document.createElement('label'),input=get(id).cloneNode(true);
   input.id='compare-'+id;input.removeAttribute('name');input.value=fields[id];label.htmlFor=input.id;label.textContent=compareLabel(id);wrapper.append(label,input);grid.append(wrapper);
   if(id==='logistics'){const hint=document.createElement('div');hint.id='compare-logistics-source';hint.className='hint';hint.setAttribute('role','status');input.setAttribute('aria-describedby',hint.id);wrapper.append(hint);}
   input.addEventListener('input',()=>{
    if(id==='chinaPrice')compareAutoSale=true;
    if(id==='salePrice'||id==='receipt')compareAutoSale=false;
    if(compareAutoSale&&['chinaPrice','fx','multiplier'].includes(id)){try{compareGet('salePrice').value=DailyCore.recommend(compareNumber('chinaPrice'),compareNumber('multiplier'),compareNumber('fx')).toFixed(2);compareGet('receipt').value=tidy(compareNumber('salePrice')+compareNumber('buyerShipping'));}catch{}}
    if(['salePrice','buyerShipping'].includes(id)){try{compareGet('receipt').value=tidy(compareNumber('salePrice')+compareNumber('buyerShipping'));}catch{compareGet('receipt').value='';}}
    if(id==='receipt'){try{const sale=compareNumber('receipt')-compareNumber('buyerShipping');compareGet('salePrice').value=sale>=0?tidy(sale):'';}catch{compareGet('salePrice').value='';}}
    renderCompare();
   });
   if(id==='currency')input.addEventListener('change',()=>{
    const next=input.value;
    try{if(compareGet('logistics').value!==''&&next!==compareCurrency){const fx=compareNumber('fx'),cost=compareNumber('logistics');compareGet('logistics').value=tidy(compareCurrency==='RMB'?cost/fx:cost*fx);}compareCurrency=next;renderCompare();}
    catch(error){input.value=compareCurrency;compareGet('message').textContent='请先填写有效汇率与物流成本再切换币种。';compareGet('message').classList.add('error');}
   });
  }
  section.append(grid);
  container.append(section);
 });
 const freightGrid=compareGet('freight-fields');freightGrid.replaceChildren();
 for(const id of compareFreightIds){
  const wrapper=document.createElement('div'),label=document.createElement('label'),input=get(id).cloneNode(true);
  input.id='compare-'+id;input.value=fields[id]??({store:'广州店铺',packType:'parcel'}[id]||'');label.htmlFor=input.id;label.textContent=compareLabel(id);
  wrapper.append(label,input);
  freightGrid.append(wrapper);
  input.addEventListener('input',()=>{updateCompareFreightQuote();renderCompare()});
 }
 updateCompareFreightQuote();
}
function updateCompareFreightQuote(){
 const dimensions=['length','width','height','weight'];compareFreightError='';compareQuote=null;
 if(dimensions.every(id=>compareGet(id).value!=='')){
  try{compareQuote=FreightCore.quote({...Object.fromEntries(dimensions.map(id=>[id,compareNumber(id)])),attribute:get('attribute').value,store:compareGet('store').value,naked:compareGet('packType').value==='naked'},compareFreightSettings)}
  catch(error){compareFreightError=error.message}
 }
 const value=compareGet('freight-estimate-value'),message=compareGet('freight-estimate-message'),button=compareGet('adopt-freight');
 if(value)value.textContent=compareQuote?money(compareQuote.cny,'RMB'):'— RMB';
 if(message){message.textContent=compareQuote?`${compareQuote.code} · 计费重 ${tidy(compareQuote.chargeWeight)} kg`:compareFreightError||'填写物流信息后显示估算结果。';message.classList.toggle('input-error',!!compareFreightError);}
 if(button)button.disabled=!compareQuote;
}
compareGet('adopt-freight').addEventListener('click',()=>{
 updateCompareFreightQuote();if(!compareQuote)return;
 try{compareGet('logistics').value=tidy(compareGet('currency').value==='USD'?compareQuote.cny/compareNumber('fx'):compareQuote.cny);renderCompare()}
 catch(error){compareGet('message').textContent=error.message;compareGet('message').classList.add('error')}
});
function createCompareSettings(){
 compareFreightSettings=FreightCore.cloneConfig(savedFreightSettings);
 const container=compareGet('settings-fields');container.replaceChildren();
 for(const [id]of settings){
  const wrapper=document.createElement('div'),label=document.createElement('label'),input=get(id).cloneNode(true);
  input.id='compare-'+id;input.value=savedBusinessSettings[id];label.htmlFor=input.id;label.textContent=compareLabel(id);wrapper.append(label,input);container.append(wrapper);
  input.addEventListener('input',()=>{
   if(compareAutoSale&&['fx','multiplier'].includes(id)){
    try{compareGet('salePrice').value=DailyCore.recommend(compareNumber('chinaPrice'),compareNumber('multiplier'),compareNumber('fx')).toFixed(2);compareGet('receipt').value=tidy(compareNumber('salePrice')+compareNumber('buyerShipping'))}catch{}
   }
   renderCompare();
  });
 }
 updateCompareFreightQuote();
}
function openComparison(record){
 try{
  validateSnapshot(record.snapshot);
  const before=record.snapshot.result;
  if(!before||!Number.isFinite(before.netRmb)||!Number.isFinite(before.netUsd)||(before.margin!==null&&!Number.isFinite(before.margin)))throw Error('历史利润结果不完整，请先载入检查。');
  CompareCore.rows(before,null,Number(record.snapshot.fields.fx),Number(record.snapshot.fields.fx));
 }catch(error){archiveMessage('无法对比：'+error.message,true);return;}
 compareReturnFocus=document.activeElement;compareRecord=JSON.parse(JSON.stringify(record));compareFreightSettings=FreightCore.cloneConfig(savedFreightSettings);compareQuote=null;compareCurrency=record.snapshot.fields.currency;compareAutoSale=false;
 compareGet('title').textContent=record.name+' · 利润对比';
 compareGet('identity').textContent=`规格编码：${record.specCode} · 商品编码：${record.productCode} · 历史保存于 ${new Date(record.savedAt).toLocaleString('zh-CN')}`;
 compareGet('baseline-label').textContent='历史净利润率 · 原始快照';
 compareGet('old-rate').textContent=comparePercent(record.snapshot.result.margin);
 compareGet('old-money').textContent=`${money(record.snapshot.result.netRmb,'RMB')} / ${money(record.snapshot.result.netUsd)}`;
 const history=compareGet('history');history.replaceChildren();
 for(const id of ['attribute',...compareFreightIds,...compareGroups.flatMap(([,ids])=>ids),...settings.map(([id])=>id)]){const item=document.createElement('div'),label=document.createElement('dt'),value=document.createElement('dd');label.textContent=id==='logistics'?'实际物流成本（'+(record.snapshot.fields.currency==='RMB'?'RMB':'💲')+'）':compareLabel(id);const source=get(id),raw=record.snapshot.fields[id];value.textContent=raw===undefined?'未记录':raw===''?'未填写':source.tagName==='SELECT'?(Array.from(source.options).find(option=>option.value===raw)?.textContent||raw):raw;item.append(label,value);history.append(item);}
 createCompareFields(compareRecord.snapshot.fields);createCompareSettings();renderCompare();compareGet('dialog').showModal();document.body.classList.add('comparison-open');compareGet('dialog').scrollTop=0;compareGet('close').focus();
}
compareGet('close').addEventListener('click',()=>compareGet('dialog').close());
compareGet('dialog').addEventListener('close',()=>{document.body.classList.remove('comparison-open');compareRecord=null;compareResult=null;compareQuote=null;compareReturnFocus?.focus();});
compareGet('reset').addEventListener('click',()=>{if(!compareRecord)return;compareCurrency=compareRecord.snapshot.fields.currency;compareQuote=null;compareAutoSale=false;createCompareFields(compareRecord.snapshot.fields);createCompareSettings();renderCompare();});
compareGet('accept').addEventListener('click',async()=>{
 if(savingMeasurement)return;
 renderCompare();
 const ids=['chinaPrice','salePrice','buyerShipping','receipt','logistics','currency',...compareFreightIds,...settings.map(([id])=>id)];
 const changes=Object.fromEntries(ids.map(id=>[id,compareGet(id).value]));
 const button=compareGet('accept');button.disabled=true;
 try{
  const freight=FreightCore.cloneConfig(compareFreightSettings);
  const saved=await saveProfit(changes,freight,{updateDefaults:false});
  for(const id of ['chinaPrice','salePrice','buyerShipping','receipt','logistics','currency',...compareFreightIds])get(id).value=changes[id];
  previousCurrency=changes.currency;autoSale=false;applyMeasurementFields(changes,freight);
  compareGet('dialog').close();showSaved(saved);
 }catch(error){compareGet('message').textContent='保存失败：'+error.message;compareGet('message').classList.add('error')}
 finally{button.disabled=false}
});

