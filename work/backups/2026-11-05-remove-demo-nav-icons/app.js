const get=id=>document.getElementById(id);
const {FEES,DEFAULTS}=DailyCore;
const money=(amount,currency='USD')=>`${amount<0?'-':''}${Math.abs(amount).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency==='USD'?'💲':'RMB'}`;
const tidy=value=>Number(value.toFixed(10)).toString();
const settings=[['fx','结算汇率','RMB/💲',.000001,1e9],['multiplier','参考售价倍率','倍',0,1000],['costRate','产品成本比例','%',0,100],['divisor','去税除数','倍',1,1e9],['tax','所得税率','%',0,100],...FEES.map(fee=>[fee.key,fee.name,'%',0,100])];
let recordConfigActive=false,recordFreightSettings=null;
const effectiveFreightConfig=()=>recordFreightSettings||savedFreightSettings;
const effectiveField=id=>recordConfigActive&&settings.some(([key])=>key===id)?get('record-'+id):get(id);
get('setting-fields').innerHTML=settings.slice(0,5).map(([key,label,unit,min,max])=>`<div><label for="${key}">${label}（${unit}）</label><input id="${key}" type="number" min="${min}" max="${max}" step="any" value="${DEFAULTS[key]}"></div>`).join('');
get('fee-fields').innerHTML=settings.slice(5).map(([key,label,unit,min,max])=>`<div><label for="${key}">${label}（${unit}）</label><input id="${key}" type="number" min="${min}" max="${max}" step="any" value="${DEFAULTS[key]}"><small>基数：${key==='royalty'?'产品成本':'真实营业收入'}</small></div>`).join('');
get('attribute').replaceChildren(new Option('',''),...Object.keys(FreightCore.RULES).map(name=>new Option(name,name)));
get('attribute').value='';
function number(id){const input=effectiveField(id);if(input.value===''||!input.validity.valid||!Number.isFinite(Number(input.value)))throw Error('请填写有效的'+(document.querySelector(`label[for="${id}"]`)?.textContent||id));return Number(input.value);}
const params=()=>Object.fromEntries(settings.map(([key])=>[key,number(key)]));
let reference=null,quote=null,quoteError='',previousCurrency='RMB',latest=null,latestInput=null,autoSale=true,converterSide='cn';
const productIds=['length','width','height','weight','attribute','store','packType'];
const signature=()=>productIds.map(id=>get(id).value).join('|')+'|'+JSON.stringify(effectiveFreightConfig());
function settingSummary(){
 const sum=FEES.filter(fee=>fee.key!=='royalty').reduce((total,fee)=>total+Number(effectiveField(fee.key).value),0);
 if(get('settings-summary'))get('settings-summary').textContent=`收入扣点${Number.isFinite(sum)?tidy(sum):'—'}% · 版权按成本${effectiveField('royalty').value||'—'}% · 去税÷${effectiveField('divisor').value||'—'} · 所得税${effectiveField('tax').value||'—'}%`;
 get('fx-display').textContent=`1 💲 = ${effectiveField('fx').value||'—'} RMB`;
 syncConverter(converterSide);
}
function referencePrice(){
 reference=null;get('referenceChina').value=get('chinaPrice').value;
 try{const china=number('chinaPrice'),multiplier=number('multiplier'),fx=number('fx');const raw=DailyCore.recommend(china,multiplier,fx);reference={china,raw,sale:Number(raw.toFixed(2))};if(autoSale){get('salePrice').value=reference.sale;syncReceipt();}}
 catch{if(autoSale){get('salePrice').value='';syncReceipt();}}
}
function renderProductDetails(){
 for(const id of ['archive-name','archive-spec','archive-product','attribute'])get(id+'-display').value=get(id).value||'—';
}
function renderFreightDetails(prefix=''){
 if(!prefix)renderProductDetails();
 for(const id of ['length','width','height','weight']){
  const input=get(prefix+id),display=get(prefix+id+'-display');
  if(display)display.value=input.value===''?'—':input.value;
 }
}
function quoteInvalid(message='',error=false,clearCost=false){quote=null;quoteError=error?message:'';if(clearCost)get('logistics').value='';renderFreightDetails();sourceLabel();}
function updateFreightQuote(fillCost=false){
 renderFreightDetails();
 const dimensions=['length','width','height','weight'];
 if(dimensions.some(id=>get(id).value==='')){quoteInvalid('选择商品后自动计算。',false,fillCost);return}
 try{
  const result=FreightCore.quote({...Object.fromEntries(dimensions.map(id=>[id,number(id)])),attribute:get('attribute').value,store:get('store').value,naked:get('packType').value==='naked'},effectiveFreightConfig());
  quote={result,signature:signature()};quoteError='';
  if(fillCost){
   const amount=get('currency').value==='USD'?result.cny/number('fx'):result.cny;
   get('logistics').value=tidy(amount);
  }
  sourceLabel();
 }catch(error){quoteInvalid(error.message,true,fillCost)}
}
function sourceLabel(){
 get('logistics-unit').textContent=get('currency').value==='RMB'?'RMB':'💲';
 get('logistics-source').textContent=quoteError?quoteError+' 请手动填写实际物流成本。':'根据物流信息自动填入，可手动修改。';
 get('logistics-source').classList.toggle('input-error',!!quoteError);
}
function clearResult(message){
 latest=null;latestInput=null;window.dailyProfit=null;
 get('net').textContent='—';get('net').classList.remove('negative');get('net').classList.remove('positive');get('net-rmb').classList.remove('positive','negative');get('margin').classList.remove('positive','negative');get('net-rmb').textContent='— RMB';get('margin').textContent='— 💲';get('net-status').textContent='待输入';
 get('breakdown').innerHTML='<tr><td colspan="3">请完成测算中的输入</td></tr>';
 get('income-value').textContent='— RMB';get('message').textContent=message;get('message').classList.add('error');
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
  const rows=[['含税实收',result.grossUsd,'light'],['真实营业收入（去税后）',result.revenueUsd,'total'],['－ 产品成本',result.costUsd,''],...result.fees.map(fee=>[`－ ${fee.name} ${tidy(fee.rate)}%${fee.key==='royalty'?'（按成本）':''}`,fee.usd,'']),['－ 实际物流成本',result.logisticsUsd,''],['税前利润',result.pretaxUsd,'total'],[`－ 所得税 ${input.tax}%`,result.taxUsd,'light'],['净利润',result.netUsd,'total']];
  get('breakdown').innerHTML=rows.map(([label,amount,style])=>`<tr class="${style}"><td>${label}</td><td>${money(amount)}</td><td>${money(amount*input.fx,'RMB')}</td></tr>`).join('');
  const warnings=[];
  if(result.rateTotal>=100)warnings.push('收入扣点合计≥100%，请核对。');
  if(result.pretaxUsd<0)warnings.push('当前亏损，所得税为0。');
  if(result.margin===null)warnings.push('零营业收入，净利率不适用。');
  get('message').textContent=warnings.join(' ');
  get('message').classList.toggle('error',result.rateTotal>=100);
 }catch(error){clearResult(error.message);}
}
for(const [key]of settings)get(key).addEventListener('input',()=>{settingSummary();referencePrice();renderProfit();});
for(const id of productIds)get(id).addEventListener('input',()=>{updateFreightQuote(true);renderProfit();});
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
get('demo').addEventListener('click',()=>{
 resetProfit();
 for(const [id,value]of Object.entries({length:20,width:15,height:10,weight:.2,chinaPrice:100}))get(id).value=value;
 get('attribute').value='潮玩';get('packType').value='parcel';get('store').value='广州店铺';settingSummary();referencePrice();updateFreightQuote();
 get('logistics').value=50.1;renderProfit();get('message').textContent='当前是演示数据，请用自己的数据替换。';
});
const chinaZone='Asia/Shanghai';
const zoneNames={'America/Los_Angeles':'太平洋','America/Denver':'山地','America/Chicago':'中部','America/New_York':'东部'};
function syncConverter(side){
 const source=get(side+'-amount'),target=get((side==='cn'?'us':'cn')+'-amount');
 if(source.value===''||!source.validity.valid){target.value='';return}
 const fx=Number(effectiveField('fx').value);
 target.value=Number.isFinite(fx)&&fx>0?tidy(Number((side==='cn'?Number(source.value)/fx:Number(source.value)*fx).toFixed(4))):'';
}
for(const side of ['cn','us'])get(side+'-amount').addEventListener('input',()=>{converterSide=side;syncConverter(side)});
function renderClocks(){
 const clockTimestamp=Date.now();
 for(const [prefix,zone]of [['us',get('zone').value],['cn',chinaZone]]){
  const local=TimeCore.local(clockTimestamp,zone);get(prefix+'-clock').textContent=local.slice(11);
  const phase=TimeCore.phase(clockTimestamp,zone);get(prefix+'-clock').closest('.time-cell').dataset.phase=phase;
  get(prefix+'-phase').textContent={morning:'上午 · 蓝天白云',noon:'正午 · 明亮日光',dusk:'黄昏 · 落日晚霞',night:'夜晚 · 静谧月色'}[phase];
  get(prefix+'-date').textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).format(clockTimestamp);
 }
 get('time-gap').textContent=`北京快 ${(TimeCore.offset(clockTimestamp,chinaZone)-TimeCore.offset(clockTimestamp,get('zone').value))/60} 小时`;
 get('us-zone-label').textContent=`美国时间 · ${zoneNames[get('zone').value]||'太平洋'}`;
}
renderFreightDetails();settingSummary();referencePrice();renderProfit();renderClocks();
setInterval(renderClocks,1000);
