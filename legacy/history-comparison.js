// History editing reuses the calculator inputs and the original save path.
// Only the layout and the read-only comparison baseline are managed here.
(()=>{
 const workspace=document.querySelector('.calculator-workspace'),inputs=document.querySelector('.calculator-inputs'),results=document.querySelector('.calculator-results');
 const actions=document.querySelector('.net-actions'),netCard=document.querySelector('.net-card'),lookup=document.querySelector('.product-lookup'),explanation=document.querySelector('.explanation');
 const originalHeader=get('measurement-back-label').textContent;
 let record=null,baselineColumn=null,newHeading=null,comparisonDock=null,comparisonHeading=null;
 let heightSyncing=false;
 const format=(value,currency='RMB')=>typeof value==='number'&&Number.isFinite(value)?money(value,currency):'—';
 const tone=value=>typeof value!=='number'||!Number.isFinite(value)||value===0?'neutral':value>0?'positive':'negative';
 const pair=(cell,rmb,usd)=>{cell.textContent=format(rmb)+' / '+format(usd,'USD');cell.className=tone(rmb)};
 function renderNetSummary(before,after){
  const panel=document.querySelector('.comparison-net-summary');if(!panel)return;
  const values=[
   ['原订单',before.netRmb,before.margin],
   ['本次修改',after?.netRmb??null,after?.margin??null],
   ['变化',before.netRmb===null||after?.netRmb===null?null:after.netRmb-before.netRmb,before.margin===null||after?.margin===null?null:after.margin-before.margin]
  ];
  panel.querySelectorAll('.comparison-net-cell').forEach((cell,index)=>{
   const [,rmb,margin]=values[index];const amount=cell.querySelector('[data-net-amount]'),rate=cell.querySelector('[data-net-rate]');
   amount.textContent=rmb===null?'—':(index===2&&rmb>=0?'+':'')+money(rmb,'RMB');
   rate.textContent=margin===null?'—':(index===2&&margin>=0?'+':'')+(margin*100).toFixed(2)+(index===2?' 个百分点':'%');
   amount.className=tone(rmb);rate.className=tone(margin);
  });
 }
 function ensureNetSummary(){
  if(document.querySelector('.comparison-net-summary'))return;
  const panel=document.createElement('div');panel.className='comparison-net-summary';
  for(const label of ['原订单','本次修改','变化']){const cell=document.createElement('div');cell.className='comparison-net-cell';cell.innerHTML=`<span>${label}</span><strong data-net-amount>—</strong><small data-net-rate>—</small>`;panel.append(cell);}
  netCard.append(panel);
 }
 function snapshotPreview(fields){
  const keys=['chinaPrice','salePrice','buyerShipping','receipt','logistics',...settings.map(([key])=>key)];
  return DailyCore.preview({...Object.fromEntries(keys.map(key=>[key,fields[key]!==undefined&&fields[key]!==''&&Number.isFinite(Number(fields[key]))?Number(fields[key]):null])),currency:fields.currency||'RMB'});
 }
 function cloneReadonly(source){
  const clone=source.cloneNode(true),from=[...source.querySelectorAll('input,select,textarea')],to=[...clone.querySelectorAll('input,select,textarea')];
  to.forEach((input,index)=>{
   if(input.type==='hidden'||input.hidden)return;
   const original=from[index],value=original.value;
   const display=document.createElement('p');display.className='comparison-read-value';
   const originalValue=original.tagName==='SELECT'?(Array.from(original.options).find(option=>option.value===value)?.textContent||value||'—'):(value||'—');
   const unit={chinaPrice:'RMB',salePrice:'💲',buyerShipping:'💲',receipt:'💲',logistics:sourceCurrency(original)}[original.id];
   display.textContent=unit&&originalValue!=='—'?`${originalValue} ${unit}`:originalValue;
   display.dataset.field=original.id;
   input.replaceWith(display);
  });
  for(const node of clone.querySelectorAll('[id]'))node.id='baseline-'+node.id;
  for(const node of clone.querySelectorAll('label[for]'))node.htmlFor='baseline-'+node.htmlFor;
  for(const node of clone.querySelectorAll('.input-unit > span'))node.remove();
  for(const node of clone.querySelectorAll('.logistics-row > select'))node.remove();
  for(const button of clone.querySelectorAll('button')){
   if(button.classList.contains('product-photo-upload')){const photo=document.createElement('div');photo.className='product-photo-upload baseline-photo';photo.append(...button.childNodes);button.replaceWith(photo);}else button.remove();
  }
  for(const node of clone.querySelectorAll('dialog,[role="status"],.actions,.explanation,.product-photo-actions,.small,.hint,input[type="hidden"],select[hidden]'))node.remove();
  return clone;
 }
 function sourceCurrency(input){
  if(input.id!=='logistics')return undefined;
  const currency=get('currency')?.value;
  return currency==='USD'?'💲':'RMB';
 }
 function renderBaseline(){
  const saved=document.createElement('div');saved.className='calculator-inputs comparison-baseline-inputs';
  const heading=document.createElement('div');heading.className='comparison-column-heading';
  const title=document.createElement('h2');title.textContent='原订单';
  const version=document.createElement('span');version.textContent=`第 ${record.version} 版 · 载入数据`;heading.append(title,version);saved.append(heading);
  for(const selector of ['.product-identity','.freight-inline','.profit-entry','.calculation-config']){
   const card=cloneReadonly(inputs.querySelector(selector));
   if(selector==='.profit-entry'){
    card.querySelectorAll('label').forEach(label=>{label.textContent=label.textContent.replace(/（RMB）|（💲）/g,'')});
    // 原订单只读区的物流成本单位已经跟在数字后面，移除旧的独立币种行。
    card.querySelectorAll('.comparison-read-value').forEach(node=>{
     if(node.dataset.field==='currency'||node.textContent.trim()==='人民币 RMB'||node.textContent.trim()==='美元 💲')node.remove();
    });
   }
   saved.append(card);
  }
  if(baselineColumn.querySelector('.comparison-baseline-inputs'))baselineColumn.querySelector('.comparison-baseline-inputs').replaceWith(saved);else baselineColumn.prepend(saved);
 }
 function syncColumnHeights(){
  if(!baselineColumn||heightSyncing)return;
  const left=[...baselineColumn.querySelectorAll('.comparison-baseline-inputs>.card,.comparison-baseline-inputs>.profit-entry')];
  const right=[...inputs.querySelectorAll('.comparison-new-inputs>.card,.comparison-new-inputs>.profit-entry')];
  if(!left.length||!right.length)return;
  heightSyncing=true;
  left.forEach((card,index)=>{
   const peer=right[index];if(!peer)return;
   card.style.minHeight='';peer.style.minHeight='';
   const height=Math.ceil(Math.max(card.getBoundingClientRect().height,peer.getBoundingClientRect().height));
   card.style.minHeight=`${height}px`;peer.style.minHeight=`${height}px`;
  });
  heightSyncing=false;
 }
 function load(next){
  record=JSON.parse(JSON.stringify(next));
  if(!baselineColumn){
   document.body.classList.add('history-comparison-mode');workspace.classList.add('history-comparison-workspace');
   baselineColumn=document.createElement('div');baselineColumn.className='comparison-baseline-column';workspace.prepend(baselineColumn);
   // 将 demo 中确认过的实时利润对比卡片放到两列内容上方，保持原有结果节点与保存逻辑不变。
   comparisonDock=document.createElement('section');comparisonDock.className='comparison-profit-dock';
   comparisonDock.setAttribute('aria-label','实时利润对比');
   workspace.parentElement.insertBefore(comparisonDock,workspace);
   // 保存操作区必须脱离实时利润卡片，避免随 sticky 对比卡片一起吸附。
   actions.remove();
   comparisonDock.append(netCard);
   inputs.append(results);
   newHeading=document.createElement('div');newHeading.className='comparison-column-heading comparison-new-heading';inputs.prepend(newHeading);
   inputs.classList.add('comparison-new-inputs');
   actions.classList.add('history-comparison-actions');inputs.insertBefore(actions,results);get('compare-current').hidden=true;
   lookup.hidden=true;explanation.hidden=true;
   document.querySelector('.profit-details').open=true;
   get('open-save').textContent='保存本次修改';
   const adoptButton=get('adopt-freight');if(adoptButton)adoptButton.textContent='采用估算';
   const resetButton=get('reset-profit');if(resetButton)resetButton.hidden=true;
   const defaultButton=get('save-default-settings');if(defaultButton)defaultButton.hidden=true;
   const defaultNote=document.querySelector('.calculation-config .section-head .small');if(defaultNote)defaultNote.hidden=true;
   const message=get('message');if(message)message.hidden=true;
   document.querySelector('main h1').textContent='订单修改与利润对比';
   comparisonHeading=document.createElement('div');comparisonHeading.className='comparison-profit-heading';
   const title=document.createElement('strong');title.textContent='实时利润对比';
   const note=document.createElement('span');note.textContent='修改任意字段后立即更新';
   comparisonHeading.append(title,note);netCard.prepend(comparisonHeading);
   ensureNetSummary();
   // 汇率仍由顶部时间栏统一提供；对比两侧不再重复显示汇率输入。
  }
  newHeading.replaceChildren();const title=document.createElement('h2'),version=document.createElement('span');title.textContent='本次修改';version.textContent=`保存为第 ${record.version+1} 版`;newHeading.append(title,version);
  renderBaseline();
  // 保存按钮放在利润明细上方，随内容正常排列；实时对比卡片单独保持可见。
  inputs.append(results);
  if(actions.parentElement!==inputs)inputs.insertBefore(actions,results);
  get('open-save').textContent='保存本次修改';
  renderProfit();
  syncColumnHeights();
 }
 function reset(){
  if(!baselineColumn)return;
  record=null;
  results.append(netCard);
  workspace.append(results);
  netCard.append(actions);actions.classList.remove('history-comparison-actions');
  comparisonDock?.remove();comparisonDock=null;
  document.querySelector('.comparison-net-summary')?.remove();
  baselineColumn.remove();baselineColumn=null;newHeading.remove();newHeading=null;
  inputs.querySelectorAll('.comparison-new-inputs>.card').forEach(card=>{card.style.minHeight=''});
  inputs.classList.remove('comparison-new-inputs');workspace.classList.remove('history-comparison-workspace');document.body.classList.remove('history-comparison-mode');
  lookup.hidden=false;explanation.hidden=false;get('compare-current').hidden=true;
  document.querySelector('main h1').textContent='跨境日常辅助测算';
  comparisonHeading?.remove();comparisonHeading=null;
  document.querySelector('.profit-details thead tr').innerHTML='<th>项目</th><th>💲</th><th>RMB</th>';
  document.querySelector('.profit-details summary').childNodes.forEach(node=>{if(node.nodeType===3)node.textContent='本单利润明细'});
 }
 function renderRows(after){
  if(!record)return false;
  const before=snapshotPreview(record.snapshot.fields);
  renderNetSummary(before,after);
  document.querySelector('.profit-details thead tr').innerHTML='<th>项目</th><th>原订单 RMB / 💲</th><th>本次修改 RMB / 💲</th><th>变化 RMB / 💲</th>';
  document.querySelector('.profit-details summary').childNodes.forEach(node=>{if(node.nodeType===3)node.textContent='利润明细对比'});
  const rows=[['含税实收','gross'],['真实营业收入（去税后）','revenue'],['产品成本','cost'],...FEES.map(fee=>[fee.key==='royalty'?'版权费（按产品成本）':fee.name,fee.key]),['实际物流成本','logistics'],['税前利润','pretax'],['所得税','tax'],['净利润','net']];
  const body=get('breakdown');body.replaceChildren();
  for(const [label,key]of rows){
   const fee=FEES.some(item=>item.key===key),oldFee=fee?before.fees.find(item=>item.key===key):null,newFee=fee?after.fees.find(item=>item.key===key):null;
   const oldRmb=fee?oldFee.rmb:before[key+'Rmb'],oldUsd=fee?oldFee.usd:before[key+'Usd'],newRmb=fee?newFee.rmb:after[key+'Rmb'],newUsd=fee?newFee.usd:after[key+'Usd'];
   const tr=document.createElement('tr'),name=document.createElement('td'),oldValue=document.createElement('td'),newValue=document.createElement('td'),delta=document.createElement('td');
   if(['真实营业收入（去税后）','税前利润','净利润'].includes(label))tr.className='total';
   name.textContent=label;pair(oldValue,oldRmb,oldUsd);pair(newValue,newRmb,newUsd);pair(delta,oldRmb===null||newRmb===null?null:newRmb-oldRmb,oldUsd===null||newUsd===null?null:newUsd-oldUsd);tr.append(name,oldValue,newValue,delta);body.append(tr);
  }
  const tr=document.createElement('tr');for(const text of ['净利润率',before.margin===null?'—':(before.margin*100).toFixed(2)+'%',after.margin===null?'—':(after.margin*100).toFixed(2)+'%',before.margin===null||after.margin===null?'—':((after.margin-before.margin)*100).toFixed(2)+' 个百分点']){const cell=document.createElement('td');cell.textContent=text;tr.append(cell);}body.append(tr);
  syncColumnHeights();
  return true;
 }
 window.HistoryComparison={load,reset,renderRows,get active(){return Boolean(record)}};
 window.addEventListener('resize',()=>{if(record)syncColumnHeights()});
})();
