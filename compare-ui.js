const compareGet=id=>get('compare-'+id);
const compareGroups=[['产品与物流参考',productIds.concat('referenceChina')],['新方案成交与成本',['chinaPrice','salePrice','buyerShipping','receipt','logistics','currency']],['新方案扣点与基础参数',settings.map(([key])=>key)]];
let compareRecord=null,compareResult=null,compareQuote=null,compareCurrency='RMB',compareReturnFocus=null;
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
function renderCompare(){
 if(!compareRecord)return;
 let error='';compareResult=null;
 try{compareResult=DailyCore.calculate(compareInput());}catch(problem){error=problem.message;}
 const before=compareRecord.snapshot.result,after=compareResult,oldFx=Number(compareRecord.snapshot.fields.fx);
 document.querySelector('label[for="compare-logistics"]').textContent='实际物流成本（'+(compareGet('currency').value==='RMB'?'RMB':'💲')+'）';
 compareGet('new-rate').textContent=after?comparePercent(after.margin):'—';
 compareGet('new-money').textContent=after?`${money(after.netRmb,'RMB')} / ${money(after.netUsd)}`:'请补全有效数据';
 const delta=after?CompareCore.marginDelta(before.margin,after.margin):null;
 compareGet('delta-rate').textContent=delta===null?'—':`${delta>0?'+':''}${delta.toFixed(2)} 个百分点`;
 compareGet('delta-money').textContent=after?`${compareSigned(after.netRmb-before.netRmb,'RMB')} / ${compareSigned(after.netUsd-before.netUsd)}`:'—';
 compareGet('delta-rate').classList.toggle('compare-down',delta!==null&&delta<0);
 compareGet('new-rate').classList.toggle('negative',!!after&&after.netUsd<0);
 compareGet('message').textContent=error||(after.margin===null?'新方案零营业收入，利润率不适用。':after.netUsd<0?'新方案亏损，所得税按0计算。':'已实时计算新方案；历史快照与原存档均未改变。');
 compareGet('message').classList.toggle('error',!!error);
 const rows=CompareCore.rows(before,after,oldFx,after?compareNumber('fx'):oldFx);
 const body=compareGet('breakdown');body.replaceChildren();
 for(const row of rows){
  const tr=document.createElement('tr');if(row.label==='净利润')tr.className='total';
  for(const text of [row.label,`${money(row.oldRmb,'RMB')} / ${money(row.oldUsd)}`,`${compareAmount(row.newRmb,'RMB')} / ${compareAmount(row.newUsd)}`,`${compareSigned(row.deltaRmb,'RMB')} / ${compareSigned(row.deltaUsd)}`]){const cell=document.createElement('td');cell.textContent=text;tr.append(cell);}body.append(tr);
 }
 let recommendation='参考售价：— 💲';compareGet('adopt-price').disabled=true;
 try{const raw=DailyCore.recommend(compareNumber('referenceChina'),compareNumber('multiplier'),compareNumber('fx'));recommendation=`参考售价：${money(raw)}（国内价 × ${compareGet('multiplier').value} ÷ ${compareGet('fx').value}）`;compareGet('adopt-price').disabled=false;}catch{}
 compareGet('price-hint').textContent=recommendation;
}
function createCompareFields(fields){
 const container=compareGet('fields');container.replaceChildren();
 compareGroups.forEach(([title,ids],groupIndex)=>{
  const section=document.createElement(groupIndex===1?'section':'details');section.className='compare-input-section';
  if(groupIndex!==1){const summary=document.createElement('summary');summary.textContent=title;section.append(summary);}else{const heading=document.createElement('h3');heading.textContent=title;section.append(heading);}
  const grid=document.createElement('div');grid.className='compare-fields';
  for(const id of ids){
   const wrapper=document.createElement('div'),label=document.createElement('label'),input=get(id).cloneNode(true);
   input.id='compare-'+id;input.removeAttribute('name');input.value=fields[id];label.htmlFor=input.id;label.textContent=compareLabel(id);wrapper.append(label,input);grid.append(wrapper);
   input.addEventListener('input',()=>{
    if(['salePrice','buyerShipping'].includes(id)){try{compareGet('receipt').value=tidy(compareNumber('salePrice')+compareNumber('buyerShipping'));}catch{compareGet('receipt').value='';}}
    if(id==='receipt'){try{const sale=compareNumber('receipt')-compareNumber('buyerShipping');compareGet('salePrice').value=sale>=0?tidy(sale):'';}catch{compareGet('salePrice').value='';}}
    if(productIds.includes(id)){compareQuote=null;compareGet('adopt-quote').disabled=true;compareGet('quote-hint').textContent='产品信息已修改，请重新计算运费；不会自动覆盖实际物流成本。';}
    renderCompare();
   });
   if(id==='currency')input.addEventListener('change',()=>{
    const next=input.value;
    try{if(compareGet('logistics').value!==''&&next!==compareCurrency){const fx=compareNumber('fx'),cost=compareNumber('logistics');compareGet('logistics').value=tidy(compareCurrency==='RMB'?cost/fx:cost*fx);}compareCurrency=next;renderCompare();}
    catch(error){input.value=compareCurrency;compareGet('message').textContent='请先填写有效汇率与物流成本再切换币种。';}
   });
  }
  section.append(grid);
  if(groupIndex===0){
   const actions=document.createElement('div');actions.className='tool-actions';
   for(const [id,text]of [['quote','计算新运费'],['adopt-quote','采用新运费'],['adopt-price','采用参考售价与组合价']]){const button=document.createElement('button');button.id='compare-'+id;button.type='button';button.textContent=text;actions.append(button);}section.append(actions);
   for(const id of ['quote-hint','price-hint']){const hint=document.createElement('p');hint.id='compare-'+id;hint.className='small';section.append(hint);}
  }
  container.append(section);
 });
 compareGet('adopt-quote').disabled=true;compareGet('quote-hint').textContent='参考运费使用原内置2026-09-28价表。仅点击采用后填入新方案，不影响历史物流成本。';
 compareGet('quote').addEventListener('click',()=>{
  try{compareQuote=FreightCore.quote({...Object.fromEntries(['length','width','height','weight'].map(id=>[id,compareNumber(id)])),attribute:compareGet('attribute').value,store:compareGet('store').value,naked:compareGet('packType').value==='naked'});compareGet('quote-hint').textContent=`新运费 ${money(compareQuote.cny,'RMB')} · ${compareQuote.code} · ${compareQuote.chargeWeight} kg计费；点击采用才修改新方案物流成本。`;compareGet('adopt-quote').disabled=false;}
  catch(error){compareQuote=null;compareGet('adopt-quote').disabled=true;compareGet('quote-hint').textContent=error.message;}
 });
 compareGet('adopt-quote').addEventListener('click',()=>{if(!compareQuote)return;compareGet('logistics').value=compareQuote.cny;compareGet('currency').value='RMB';compareCurrency='RMB';renderCompare();});
 compareGet('adopt-price').addEventListener('click',()=>{try{const china=compareNumber('referenceChina'),raw=DailyCore.recommend(china,compareNumber('multiplier'),compareNumber('fx'));compareGet('chinaPrice').value=china;compareGet('salePrice').value=raw.toFixed(2);compareGet('receipt').value=tidy(Number(raw.toFixed(2))+compareNumber('buyerShipping'));renderCompare();}catch(error){compareGet('message').textContent=error.message;}});
}
function openComparison(record){
 try{
  validateSnapshot(record.snapshot);
  const before=record.snapshot.result;
  if(!before||!Number.isFinite(before.netRmb)||!Number.isFinite(before.netUsd)||(before.margin!==null&&!Number.isFinite(before.margin)))throw Error('历史利润结果不完整，请先载入检查。');
  CompareCore.rows(before,null,Number(record.snapshot.fields.fx),Number(record.snapshot.fields.fx));
 }catch(error){archiveMessage('无法对比：'+error.message,true);return;}
 compareReturnFocus=document.activeElement;compareRecord=JSON.parse(JSON.stringify(record));compareQuote=null;compareCurrency=record.snapshot.fields.currency;
 compareGet('title').textContent=record.name+' · 利润对比';
 compareGet('identity').textContent=record.temporary?'当前测算的临时快照 · 未写入存档':`规格编码：${record.specCode} · 商品编码：${record.productCode} · 历史保存于 ${new Date(record.savedAt).toLocaleString('zh-CN')}`;
 compareGet('baseline-label').textContent=record.temporary?'当前净利润率 · 固定快照':'历史净利润率 · 原始快照';
 compareGet('old-rate').textContent=comparePercent(record.snapshot.result.margin);
 compareGet('old-money').textContent=`${money(record.snapshot.result.netRmb,'RMB')} / ${money(record.snapshot.result.netUsd)}`;
 const history=compareGet('history');history.replaceChildren();
 for(const [,ids]of compareGroups)for(const id of ids){const item=document.createElement('div'),label=document.createElement('dt'),value=document.createElement('dd');label.textContent=id==='logistics'?'实际物流成本（'+(record.snapshot.fields.currency==='RMB'?'RMB':'💲')+'）':compareLabel(id);const source=get(id),raw=record.snapshot.fields[id];value.textContent=raw===''?'未填写':source.tagName==='SELECT'?(Array.from(source.options).find(option=>option.value===raw)?.textContent||raw):raw;item.append(label,value);history.append(item);}
 createCompareFields(compareRecord.snapshot.fields);renderCompare();compareGet('dialog').showModal();document.body.classList.add('comparison-open');compareGet('dialog').scrollTop=0;compareGet('close').focus();
}
compareGet('close').addEventListener('click',()=>compareGet('dialog').close());
compareGet('dialog').addEventListener('close',()=>{document.body.classList.remove('comparison-open');compareRecord=null;compareResult=null;compareQuote=null;compareReturnFocus?.focus();});
compareGet('reset').addEventListener('click',()=>{if(!compareRecord)return;compareCurrency=compareRecord.snapshot.fields.currency;compareQuote=null;createCompareFields(compareRecord.snapshot.fields);renderCompare();});

get('compare-current').addEventListener('click',()=>{
 renderProfit();
 if(!latest){get('message').textContent='请先完成有效利润测算，再进行对比。';return;}
 openComparison({name:get('archive-name').value.trim()||'当前产品',specCode:get('archive-spec').value,productCode:get('archive-product').value,savedAt:new Date().toISOString(),temporary:true,snapshot:{fields:Object.fromEntries(archiveFieldIds.map(id=>[id,get(id).value])),result:latest,input:latestInput,reference,quote,adoptedQuote}});
});
