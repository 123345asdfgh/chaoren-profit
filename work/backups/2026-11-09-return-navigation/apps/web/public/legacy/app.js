const get=id=>document.getElementById(id);
const {FEES,DEFAULTS}=DailyCore;
const money=(amount,currency='USD')=>`${amount<0?'-':''}${Math.abs(amount).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency==='USD'?'💲':'RMB'}`;
const tidy=value=>Number(value.toFixed(10)).toString();
const settings=[['fx','结算汇率','RMB/💲',.000001,1e9],['multiplier','参考售价倍率','倍',0,1000],['costRate','产品成本比例','%',0,100],['divisor','去税除数','倍',1,1e9],['tax','所得税率','%',0,100],...FEES.map(fee=>[fee.key,fee.name,'%',0,100])];
let recordFreightSettings=null;
const effectiveFreightConfig=()=>recordFreightSettings||savedFreightSettings;
const effectiveField=id=>get(id);
get('setting-fields').innerHTML=settings.slice(0,5).filter(([key])=>key!=='fx').map(([key,label,unit,min,max])=>`<div><label for="${key}">${label}（${unit}）</label><input id="${key}" type="number" min="${min}" max="${max}" step="any" value="${DEFAULTS[key]}"></div>`).join('');
get('fee-fields').innerHTML=settings.slice(5).map(([key,label,unit,min,max])=>`<div><label for="${key}">${label}（${unit}）</label><input id="${key}" type="number" min="${min}" max="${max}" step="any" value="${DEFAULTS[key]}"></div>`).join('');
get('attribute').replaceChildren(new Option('未选择（选填）',''),...FreightCore.CATEGORIES.map(name=>new Option(name,name)));
get('attribute').value='';
function number(id){const input=effectiveField(id);if(input.value===''||!input.validity.valid||!Number.isFinite(Number(input.value)))throw Error('请填写有效的'+(document.querySelector(`label[for="${id}"]`)?.textContent||id));return Number(input.value);}
const params=()=>Object.fromEntries(settings.map(([key])=>[key,number(key)]));
let reference=null,quote=null,quoteError='',previousCurrency='RMB',latest=null,latestInput=null,autoSale=true;
const productIds=['length','width','height','weight','attribute','store','packType'];
const signature=()=>productIds.map(id=>get(id).value).join('|')+'|'+JSON.stringify(effectiveFreightConfig());
function settingSummary(){
 const sum=FEES.filter(fee=>fee.key!=='royalty').reduce((total,fee)=>total+Number(effectiveField(fee.key).value),0);
 if(get('settings-summary'))get('settings-summary').textContent=`收入扣点${Number.isFinite(sum)?tidy(sum):'—'}% · 版权按成本${effectiveField('royalty').value||'—'}% · 去税÷${effectiveField('divisor').value||'—'} · 所得税${effectiveField('tax').value||'—'}%`;

}
function referencePrice(){
 reference=null;get('referenceChina').value=get('chinaPrice').value;
 try{const china=number('chinaPrice'),multiplier=number('multiplier'),fx=number('fx');const raw=DailyCore.recommend(china,multiplier,fx);reference={china,raw,sale:Number(raw.toFixed(2))};if(autoSale){get('salePrice').value=reference.sale;syncReceipt();}}
 catch{if(autoSale){get('salePrice').value='';syncReceipt();}}
}
function renderProductDetails(){
 for(const id of ['archive-name','archive-spec','archive-product','attribute']){const output=get(id+'-display');if(output)output.value=get(id).value||'—';}
}
function renderFreightDetails(prefix=''){
 if(!prefix)renderProductDetails();
 for(const id of ['length','width','height','weight']){
  const input=get(prefix+id),display=get(prefix+id+'-display');
  if(display)display.value=input.value===''?'—':input.value;
 }
}
function renderFreightEstimate(){
 const value=get('freight-estimate-value'),message=get('freight-estimate-message'),button=get('adopt-freight');
 if(value)value.textContent=quote?money(quote.result.cny,'RMB'):'— RMB';
 if(message){message.textContent=quote?`${quote.result.code} · 计费重 ${tidy(quote.result.chargeWeight)} kg`:quoteError||'填写物流信息后显示估算结果。';message.classList.toggle('input-error',!!quoteError);}
 if(button)button.disabled=!quote;
}
function quoteInvalid(message='',error=false){quote=null;quoteError=error?message:'';renderFreightDetails();sourceLabel();renderFreightEstimate();}
function updateFreightQuote(){
 renderFreightDetails();
 const dimensions=['length','width','height','weight'];
 if(dimensions.some(id=>get(id).value==='')||!get('attribute').value){quoteInvalid();return}
 try{
  const result=FreightCore.quote({...Object.fromEntries(dimensions.map(id=>[id,number(id)])),attribute:get('attribute').value,store:get('store').value,naked:get('packType').value==='naked'},effectiveFreightConfig());
  quote={result,signature:signature()};quoteError='';sourceLabel();renderFreightEstimate();
 }catch(error){quoteInvalid(error.message,true)}
}
get('adopt-freight').addEventListener('click',()=>{
 updateFreightQuote();if(!quote)return;
 try{get('logistics').value=tidy(get('currency').value==='USD'?quote.result.cny/number('fx'):quote.result.cny);renderProfit()}
 catch(error){get('message').textContent=error.message;get('message').classList.add('error')}
});
function sourceLabel(){
 get('logistics-unit').textContent=get('currency').value==='RMB'?'RMB':'💲';
 get('logistics-source').textContent=quoteError?quoteError+' 请手动填写实际物流成本。':'点击“采用”填入物流估算，也可自行填写实际成本。';
 get('logistics-source').classList.toggle('input-error',!!quoteError);
}
function readProfitPreviewInput(prefix=''){
 const keys=['chinaPrice','salePrice','buyerShipping','receipt','logistics',...settings.map(([key])=>key)];
 return {...Object.fromEntries(keys.map(key=>{const input=get(prefix+key);return [key,input.value!==''&&input.checkValidity()&&Number.isFinite(Number(input.value))?Number(input.value):null];})),currency:get(prefix+'currency').value};
}
const profitAmount=(value,currency='USD')=>value===null?'—':money(value,currency);
function renderProfitRows(result){
 const rows=[['含税实收',result.grossUsd,result.grossRmb,'light'],['真实营业收入（去税后）',result.revenueUsd,result.revenueRmb,'total'],['－ 产品成本',result.costUsd,result.costRmb,''],...result.fees.map(fee=>[`－ ${fee.name}${fee.rate===null?'':' '+tidy(fee.rate)+'%'}${fee.key==='royalty'?'（按成本）':''}`,fee.usd,fee.rmb,'']),['－ 实际物流成本',result.logisticsUsd,result.logisticsRmb,''],['税前利润',result.pretaxUsd,result.pretaxRmb,'total'],[`－ 所得税${result.taxRate===null?'':' '+tidy(result.taxRate)+'%'}`,result.taxUsd,result.taxRmb,'light'],['净利润',result.netUsd,result.netRmb,'total']];
 get('breakdown').innerHTML=rows.map(([label,usd,rmb,style])=>`<tr class="${style}"><td>${label}</td><td>${profitAmount(usd)}</td><td>${profitAmount(rmb,'RMB')}</td></tr>`).join('');
}
function clearResult(message){
 latest=null;latestInput=null;window.dailyProfit=null;
 const partial=DailyCore.preview(readProfitPreviewInput());
 get('net').textContent=partial.margin===null?(partial.netUsd===null?'—':'不适用'):(partial.margin*100).toFixed(2)+'%';
 get('net-rmb').textContent=partial.netRmb===null?'— RMB':money(partial.netRmb,'RMB');get('margin').textContent=partial.netUsd===null?'— 💲':money(partial.netUsd);
 for(const [id,value]of [['net',partial.margin],['net-rmb',partial.netRmb],['margin',partial.netUsd]]){get(id).classList.toggle('negative',value!==null&&value<0);get(id).classList.toggle('positive',value!==null&&value>0);}
 get('net-status').textContent=partial.netUsd===null?'待完善':partial.netUsd<0?'亏损':Math.abs(partial.netUsd)<1e-10?'盈亏平衡':'盈利';
 renderProfitRows(partial);
 get('income-value').textContent=partial.revenueRmb===null?'— RMB':money(partial.revenueRmb,'RMB');get('message').textContent=message;get('message').classList.add('error');
}
function syncReceipt(){
 try{get('receipt').value=tidy(number('salePrice')+number('buyerShipping'));}catch{get('receipt').value='';}
}
function renderProfit(){
 sourceLabel();
 try{
  const sale=number('salePrice'),buyerShipping=number('buyerShipping'),receipt=number('receipt');
  if(Math.abs(sale+buyerShipping-receipt)>Math.max(1e-8,receipt*1e-12))throw Error('最终实收与商品售价、买家运费不一致，请修改实收或售价。');
  const input={...params(),chinaPrice:number('chinaPrice'),receipt,logistics:number('logistics'),currency:get('currency').value,salePrice:sale,buyerShipping};
  const result=DailyCore.calculate(input);latest=result;latestInput=input;window.dailyProfit=result;
  get('net').textContent=result.margin===null?'不适用':(result.margin*100).toFixed(2)+'%';get('net').classList.toggle('negative',result.netUsd<0);get('net-rmb').textContent=money(result.netRmb,'RMB');
  for(const id of ['net','net-rmb','margin']){get(id).classList.toggle('positive',result.netUsd>0);get(id).classList.toggle('negative',result.netUsd<0);}
  get('margin').textContent=money(result.netUsd);get('net-status').textContent=result.netUsd<0?'亏损':Math.abs(result.netUsd)<1e-10?'盈亏平衡':'盈利';
  get('income-value').textContent=money(result.revenueRmb,'RMB');
  renderProfitRows(DailyCore.preview(input));
  const warnings=[];
  if(result.rateTotal>=100)warnings.push('收入扣点合计≥100%，请核对。');
  if(result.pretaxUsd<0)warnings.push('当前亏损，所得税为0。');
  if(result.margin===null)warnings.push('零营业收入，净利率不适用。');
  get('message').textContent=warnings.join(' ');
  get('message').classList.toggle('error',result.rateTotal>=100);
 }catch(error){
  const missing=['chinaPrice','salePrice','buyerShipping','receipt','logistics',...settings.map(([key])=>key)].some(id=>get(id).value==='');
  const invalid=[...document.querySelectorAll('main input,main select')].some(input=>!input.checkValidity()&&input.id!=='archive-spec');
  clearResult(missing&&!invalid?'测算数据尚未完整，可先保存，补全后自动计算。':error.message);
  if(missing&&!invalid)get('message').classList.remove('error');
 }
}
for(const [key]of settings)get(key).addEventListener('input',()=>{settingSummary();referencePrice();renderProfit();});
for(const id of productIds)get(id).addEventListener('input',()=>{updateFreightQuote();renderProfit();});
for(const id of ['chinaPrice','salePrice','buyerShipping','logistics'])get(id).addEventListener('input',()=>{
 if(id==='chinaPrice'){autoSale=true;referencePrice();}
 if(id==='salePrice')autoSale=false;
 if(['salePrice','buyerShipping'].includes(id))syncReceipt();renderProfit();
});
get('receipt').addEventListener('input',()=>{
 try{const receipt=number('receipt'),shipping=number('buyerShipping');if(receipt<shipping||receipt-shipping>1e9)throw Error('最终实收不能小于买家运费，且商品售价须在有效范围。');autoSale=false;get('salePrice').value=tidy(receipt-shipping);renderProfit();}
 catch(error){clearResult(error.message);}
});
get('currency').addEventListener('change',()=>{
 const next=get('currency').value;
 if(get('logistics').value!==''&&next!==previousCurrency){try{const fx=number('fx'),value=number('logistics');get('logistics').value=tidy(previousCurrency==='RMB'?value/fx:value*fx);}catch(error){get('currency').value=previousCurrency;get('message').textContent='请先填写有效汇率与成本再切换币种。';get('message').classList.add('error');return;}}
 previousCurrency=next;renderProfit();
});
function resetProfit(){for(const id of ['chinaPrice','salePrice','receipt','logistics','referenceChina'])get(id).value='';get('buyerShipping').value=0;get('currency').value='RMB';previousCurrency='RMB';autoSale=true;referencePrice();renderProfit();}
get('reset-profit').addEventListener('click',resetProfit);
const chinaZone='Asia/Shanghai';
const zoneNames={'America/Los_Angeles':'太平洋','America/Denver':'山地','America/Chicago':'中部','America/New_York':'东部'};
let clockTimestamp=Date.now(),clockLive=true,clockCandidates=[];
function renderClocks(){
 for(const [prefix,zone]of [['us',get('zone').value],['cn',chinaZone]]){
  const local=TimeCore.local(clockTimestamp,zone);get(prefix+'-clock').textContent=local.slice(11);
  const phase=TimeCore.phase(clockTimestamp,zone);get(prefix+'-clock').closest('.time-cell').dataset.phase=phase;
  get(prefix+'-phase').textContent={morning:'上午 · 蓝天白云',noon:'正午 · 明亮日光',dusk:'黄昏 · 落日晚霞',night:'夜晚 · 静谧月色'}[phase];
  get(prefix+'-date').textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).format(clockTimestamp);
  if(document.activeElement!==get(prefix+'-time'))get(prefix+'-time').value=local;
 }
 window.TimePicker?.sync();
 get('time-status').textContent=clockLive?'● 实时同步':'◷ 自定义时间';
 get('time-gap').textContent=`北京快 ${(TimeCore.offset(clockTimestamp,chinaZone)-TimeCore.offset(clockTimestamp,get('zone').value))/60} 小时`;
}
get('toggle-time').addEventListener('click',()=>{get('time-edit').hidden=!get('time-edit').hidden;get('toggle-time').setAttribute('aria-expanded',String(!get('time-edit').hidden));get('toggle-time').textContent=get('time-edit').hidden?'换算其他时间 ↗':'收起时间换算 ↑';});
function convertClockInput(prefix){
  const input=get(prefix+'-time');
  clockLive=false;get('time-fold').hidden=true;
  if(!input.value||!input.validity.valid){get('time-message').classList.add('input-error');get('time-message').textContent='请输入2000–2099年内的完整日期时间。';return false;}
  clockCandidates=TimeCore.resolve(input.value,prefix==='us'?get('zone').value:chinaZone);
  if(!clockCandidates.length){get('time-message').classList.add('input-error');get('time-message').textContent='该时间因夏令时跳时不存在，请重新填写。';return false;}
  clockTimestamp=clockCandidates[0];get('time-message').classList.remove('input-error');get('time-message').textContent=clockCandidates.length>1?'夏令时结束，该时间有两次，默认第一次；可选择。':'';
  if(clockCandidates.length>1){get('time-occurrence').replaceChildren(...clockCandidates.map((value,index)=>new Option(`第${index+1}次 → 北京 ${TimeCore.local(value,chinaZone).replace('T',' ')}`,String(index))));get('time-fold').hidden=false;}
  renderClocks();
  return true;
}
for(const prefix of ['us','cn']){
 const input=get(prefix+'-time');input.addEventListener('focus',()=>{clockLive=false;renderClocks();});
 input.addEventListener('change',()=>convertClockInput(prefix));
}
get('time-occurrence').addEventListener('change',()=>{clockTimestamp=clockCandidates[Number(get('time-occurrence').value)];renderClocks();});
get('zone-setting').addEventListener('change',()=>{get('zone').value=get('zone-setting').value;get('time-fold').hidden=true;get('time-message').textContent='';get('time-message').classList.remove('input-error');renderClocks();});
get('time-now').addEventListener('click',()=>{clockLive=true;clockTimestamp=Date.now();get('time-fold').hidden=true;get('time-message').textContent='';get('time-message').classList.remove('input-error');renderClocks();});
renderFreightDetails();settingSummary();referencePrice();renderProfit();renderClocks();
setInterval(()=>{if(clockLive){clockTimestamp=Date.now();renderClocks();}},1000);
