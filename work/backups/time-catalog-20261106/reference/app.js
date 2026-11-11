const get=id=>document.getElementById(id);
const {FEES,DEFAULTS}=DailyCore;
const money=(amount,currency='USD')=>`${amount<0?'-':''}${Math.abs(amount).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency==='USD'?'💲':'RMB'}`;
const tidy=value=>Number(value.toFixed(10)).toString();
const settings=[['fx','美元汇率','RMB/💲',.000001,1e9],['multiplier','参考售价倍率','倍',0,1000],['costRate','产品成本比例','%',0,100],['divisor','去税除数','倍',1,1e9],['tax','所得税','%',0,100],...FEES.map(fee=>[fee.key,fee.key==='royalty'?'版权费·按产品成本':fee.name,'%',0,100])];
get('setting-fields').innerHTML=settings.filter(([key])=>key!=='fx').map(([key,label,unit,min,max])=>`<div><label for="${key}">${label}（${unit}）</label><input id="${key}" type="number" min="${min}" max="${max}" step="any" value="${DEFAULTS[key]}"></div>`).join('');
get('attribute').replaceChildren(...Object.keys(FreightCore.RULES).map(name=>new Option(name,name)));
get('attribute').value='潮玩';
function number(id){const input=get(id);if(input.value===''||!input.validity.valid||!Number.isFinite(Number(input.value)))throw Error('请填写有效的'+(document.querySelector(`label[for="${id}"]`)?.textContent||id));return Number(input.value);}
const params=()=>Object.fromEntries(settings.map(([key])=>[key,number(key)]));
let reference=null,quote=null,adoptedQuote=null,previousCurrency='RMB',latest=null,latestInput=null;
const productIds=['length','width','height','weight','attribute','store','packType'];
const signature=()=>productIds.map(id=>get(id).value).join('|');
function settingSummary(){
 const sum=FEES.filter(fee=>fee.key!=='royalty').reduce((total,fee)=>total+Number(get(fee.key).value),0);
 get('settings-summary').textContent=`收入扣点${Number.isFinite(sum)?tidy(sum):'—'}% · 版权按成本${get('royalty').value||'—'}% · 去税÷${get('divisor').value||'—'} · 所得税${get('tax').value||'—'}%`;
 get('fx-hint').textContent=`汇率 ${get('fx').value||'—'} RMB/💲`;
}
function referencePrice(){
 reference=null;get('adopt-price').disabled=true;
 get('reference-formula').textContent=`国内价 × ${get('multiplier').value||'—'} ÷ ${get('fx').value||'—'}`;
 try{const china=number('referenceChina'),multiplier=number('multiplier'),fx=number('fx');const raw=DailyCore.recommend(china,multiplier,fx);reference={china,raw,sale:Number(raw.toFixed(2))};get('reference-price').textContent=money(raw);get('adopt-price').disabled=false;}
 catch(error){get('reference-price').textContent='— 💲';}
}
function paintQuote(){
 if(!quote)return;
 const result=quote.result;let usd='汇率无效，暂不显示💲';
 try{usd=money(result.cny/number('fx'));}catch{}
 const adopted=adoptedQuote&&adoptedQuote.signature===quote.signature&&adoptedQuote.cny===result.cny;
 get('quote-result').classList.remove('error');
 get('quote-result').textContent=`${money(result.cny,'RMB')} / ${usd}\n${result.code} · ${result.chargeWeight} kg计费${result.naked?' · 裸货包装预估':''} · ${result.mode==='actual'?'仅计实重':'实重与材积取大'}\n${result.chargeWeight} kg × ${result.rate} RMB/kg ＋ ${result.fee+result.extra} RMB/票${adopted?' · 已填入01':''}`;
 get('adopt-quote').disabled=false;
}
function quoteInvalid(message){quote=null;get('adopt-quote').disabled=true;get('quote-result').textContent=message;get('quote-result').classList.remove('error');}
function sourceLabel(){
 get('logistics-unit').textContent=get('currency').value==='RMB'?'RMB':'💲';
 get('logistics-source').textContent=adoptedQuote?`采用${adoptedQuote.code}报价 ${money(adoptedQuote.cny,'RMB')}。${adoptedQuote.signature!==signature()?'产品参数已变更，当前保留旧运费，请重新测算确认。':'可直接手动修改。'}`:'手动填写；与买家运费独立。查询不会自动覆盖。';
}
function clearResult(message){
 latest=null;latestInput=null;window.dailyProfit=null;
 get('net').textContent='—';get('net').classList.remove('negative');get('net').classList.remove('positive');get('net-rmb').classList.remove('positive','negative');get('margin').classList.remove('positive','negative');get('net-rmb').textContent='— RMB';get('margin').textContent='— 💲';get('net-status').textContent='待输入';
 get('breakdown').innerHTML='<tr><td colspan="3">请完成01中的输入</td></tr>';
 get('income-bridge').textContent='含税实收 → 按底部去税系数换算真实营业收入';get('message').textContent=message;
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
  get('income-bridge').textContent=`实收 ${money(receipt)} × ${input.fx} ＝ ${money(result.grossRmb,'RMB')}；÷ ${input.divisor} ＝ ${money(result.revenueRmb,'RMB')}（真实营业收入）`;
  const rows=[['含税实收',result.grossUsd,'light'],['真实营业收入（去税后）',result.revenueUsd,'total'],['－ 产品成本',result.costUsd,''],...result.fees.map(fee=>[`－ ${fee.name} ${tidy(fee.rate)}%${fee.key==='royalty'?'（按成本）':''}`,fee.usd,'']),['－ 实际物流成本',result.logisticsUsd,''],['税前利润',result.pretaxUsd,'total'],[`－ 所得税 ${input.tax}%`,result.taxUsd,'light'],['净利润',result.netUsd,'total']];
  get('breakdown').innerHTML=rows.map(([label,amount,style])=>`<tr class="${style}"><td>${label}</td><td>${money(amount)}</td><td>${money(amount*input.fx,'RMB')}</td></tr>`).join('');
  const warnings=[];
  if(result.rateTotal>=100)warnings.push('收入扣点合计≥100%，请核对。');
  if(result.pretaxUsd<0)warnings.push('当前亏损，所得税为0。');
  if(result.margin===null)warnings.push('零营业收入，净利率不适用。');
  if(adoptedQuote&&adoptedQuote.signature!==signature())warnings.push('产品参数变动，01仍使用旧物流成本，请确认。');
  get('message').textContent=warnings.join(' ')||'已按最终实收测算。参考价、包邮与实际成本由你确认。';
 }catch(error){clearResult(error.message);}
}
get('referenceChina').addEventListener('input',referencePrice);
for(const [key]of settings)get(key).addEventListener('input',()=>{settingSummary();referencePrice();paintQuote();renderProfit();});
get('adopt-price').addEventListener('click',()=>{
 if(!reference)return;
 get('chinaPrice').value=reference.china;get('salePrice').value=reference.sale;syncReceipt();renderProfit();
 get('message').textContent='参考组合价与售价已填入01（售价保留2位），可自行调整。'+(latest?'':'请继续填写实际物流成本。');
});
for(const id of productIds)get(id).addEventListener('input',()=>{quoteInvalid('产品信息已修改，请重新计算运费；不会改变01中已填写的成本。');renderProfit();});
get('quote').addEventListener('click',()=>{
 try{quote={result:FreightCore.quote({length:number('length'),width:number('width'),height:number('height'),weight:number('weight'),attribute:get('attribute').value,store:get('store').value,naked:get('packType').value==='naked'}),signature:signature()};paintQuote();}
 catch(error){quoteInvalid(error.message);get('quote-result').classList.add('error');}
});
get('adopt-quote').addEventListener('click',()=>{
 if(!quote||quote.signature!==signature())return;
 get('logistics').value=quote.result.cny;get('currency').value='RMB';previousCurrency='RMB';
 adoptedQuote={cny:quote.result.cny,code:quote.result.code,signature:quote.signature};paintQuote();renderProfit();
});
for(const id of ['chinaPrice','salePrice','buyerShipping','logistics'])get(id).addEventListener('input',()=>{
 if(id==='logistics'){adoptedQuote=null;paintQuote();}
 if(['salePrice','buyerShipping'].includes(id))syncReceipt();renderProfit();
});
get('receipt').addEventListener('input',()=>{
 try{const receipt=number('receipt'),shipping=number('buyerShipping');if(receipt<shipping||receipt-shipping>1e9)throw Error('最终实收不能小于买家运费，且商品售价须在有效范围。');get('salePrice').value=tidy(receipt-shipping);renderProfit();}
 catch(error){clearResult(error.message);}
});
get('currency').addEventListener('change',()=>{
 const next=get('currency').value;
 if(get('logistics').value!==''&&next!==previousCurrency){try{const fx=number('fx'),value=number('logistics');get('logistics').value=tidy(previousCurrency==='RMB'?value/fx:value*fx);}catch(error){get('currency').value=previousCurrency;get('message').textContent='请先填写有效汇率与成本再切换币种。';return;}}
 previousCurrency=next;adoptedQuote=null;paintQuote();renderProfit();
});
function resetProfit(){for(const id of ['chinaPrice','salePrice','receipt','logistics'])get(id).value='';get('buyerShipping').value=0;get('currency').value='RMB';previousCurrency='RMB';adoptedQuote=null;paintQuote();renderProfit();}
get('reset-profit').addEventListener('click',resetProfit);
get('reset-settings').addEventListener('click',()=>{for(const [key,value]of Object.entries(DEFAULTS))get(key).value=value;settingSummary();referencePrice();paintQuote();renderProfit();});
get('demo').addEventListener('click',()=>{
 resetProfit();for(const [key,value]of Object.entries(DEFAULTS))get(key).value=value;
 for(const [id,value]of Object.entries({length:20,width:15,height:10,weight:.2,referenceChina:100}))get(id).value=value;
 get('attribute').value='潮玩';get('packType').value='parcel';get('store').value='广州店铺';settingSummary();referencePrice();quoteInvalid('演示产品已填好，点击计算运费再决定是否填入01。');
 get('adopt-price').click();get('logistics').value=50.1;renderProfit();get('message').textContent='当前是演示：100 RMB组合价 → 参考售价41.18💲，买家运费0💲，实际物流50.10 RMB。请用自己的数据替换。';
});
get('export').addEventListener('click',()=>{
 if(!latest){get('message').textContent='请先完成有效利润测算。';return;}
 const result=latest,input=latestInput;
 const rows=[['跨境日常辅助测算','V3.1'],['输入项目','数值','单位'],['中国组合价',input.chinaPrice,'RMB'],['商品售价',input.salePrice,'💲'],['买家运费',input.buyerShipping,'💲'],['最终含税实收',input.receipt,'💲'],['实际物流成本',input.logistics,input.currency==='RMB'?'RMB':'💲'],...settings.map(([key,label,unit])=>[label,input[key],unit]),['参考国内组合价',reference?reference.china:'未填写','RMB'],['参考售价',reference?reference.sale:'未填写','💲'],['物流来源',adoptedQuote?`${adoptedQuote.code}${adoptedQuote.signature!==signature()?'（产品已改，旧报价需确认）':''}`:'手动'],['利润项目','💲','RMB'],...[
 ['含税实收',result.grossUsd,result.grossRmb],['真实营业收入',result.revenueUsd,result.revenueRmb],['产品成本',result.costUsd,result.costRmb],...result.fees.map(fee=>[fee.key==='royalty'?'版权费（产品成本×比例）':fee.name,fee.usd,fee.rmb]),['实际物流成本',result.logisticsUsd,result.logisticsRmb],['税前利润',result.pretaxUsd,result.pretaxUsd*input.fx],['所得税',result.taxUsd,result.taxUsd*input.fx],['净利润',result.netUsd,result.netRmb]
 ].map(([label,usd,rmb])=>[label,usd.toFixed(2),rmb.toFixed(2)]),['净利润率',result.margin===null?'不适用':(result.margin*100).toFixed(2)+'%'],['说明','未自动判断包邮；版权费按产品成本；其余扣点按去税收入；物流价表2026-09-28。']];
 const text=rows.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/csv;charset=utf-8;'}));const anchor=document.createElement('a');anchor.href=url;anchor.download='跨境日常辅助测算.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);get('message').textContent='已导出当前参数与利润明细。';
});
let clockTimestamp=Date.now(),clockLive=true,clockCandidates=[];
const chinaZone='Asia/Shanghai';
function renderClocks(){
 for(const [prefix,zone]of [['us',get('zone').value],['cn',chinaZone]]){
  const local=TimeCore.local(clockTimestamp,zone);get(prefix+'-clock').textContent=local.slice(11);
  const phase=TimeCore.phase(clockTimestamp,zone);get(prefix+'-clock').closest('.time-cell').dataset.phase=phase;
  get(prefix+'-phase').textContent={morning:'上午 · 蓝天白云',noon:'正午 · 明亮日光',dusk:'黄昏 · 落日晚霞',night:'夜晚 · 静谧月色'}[phase];
  get(prefix+'-date').textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).format(clockTimestamp);
  if(document.activeElement!==get(prefix+'-time'))get(prefix+'-time').value=local;
 }
 get('time-status').textContent=clockLive?'● 实时同步':'◷ 自定义时间';
 get('time-gap').textContent=`北京快 ${(TimeCore.offset(clockTimestamp,chinaZone)-TimeCore.offset(clockTimestamp,get('zone').value))/60} 小时`;
}
get('toggle-time').addEventListener('click',()=>{get('time-edit').hidden=!get('time-edit').hidden;get('toggle-time').setAttribute('aria-expanded',String(!get('time-edit').hidden));get('toggle-time').textContent=get('time-edit').hidden?'换算其他时间 ↗':'收起时间换算 ↑';});
for(const prefix of ['us','cn']){
 const input=get(prefix+'-time');input.addEventListener('focus',()=>{clockLive=false;renderClocks();});
 input.addEventListener('change',()=>{
  clockLive=false;get('time-fold').hidden=true;
  if(!input.value||!input.validity.valid){get('time-message').textContent='请输入2000–2099年内的完整日期时间。';return;}
  clockCandidates=TimeCore.resolve(input.value,prefix==='us'?get('zone').value:chinaZone);
  if(!clockCandidates.length){get('time-message').textContent='该时间因夏令时跳时不存在，请重新填写。';return;}
  clockTimestamp=clockCandidates[0];get('time-message').textContent=clockCandidates.length>1?'夏令时结束，该时间有两次，默认第一次；可选择。':'已换算；点击回到当前时间恢复走时。';
  if(clockCandidates.length>1){get('time-occurrence').replaceChildren(...clockCandidates.map((value,index)=>new Option(`第${index+1}次 → 北京 ${TimeCore.local(value,chinaZone).replace('T',' ')}`,String(index))));get('time-fold').hidden=false;}
  renderClocks();
 });
}
get('time-occurrence').addEventListener('change',()=>{clockTimestamp=clockCandidates[Number(get('time-occurrence').value)];renderClocks();});
get('zone').addEventListener('change',()=>{get('time-fold').hidden=true;get('time-message').textContent='';renderClocks();});
get('time-now').addEventListener('click',()=>{clockLive=true;clockTimestamp=Date.now();get('time-fold').hidden=true;get('time-message').textContent='';renderClocks();});
settingSummary();referencePrice();renderProfit();renderClocks();
setInterval(()=>{if(clockLive){clockTimestamp=Date.now();renderClocks();}},1000);
