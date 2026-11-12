(function(root){
 'use strict';
 function rows(before,after,beforeFx,afterFx){
  const amount=(key)=>[before[key+'Usd'],after?.[key+'Usd']??null,after?.partial===true?after[key+'Rmb']??null:undefined];
  const entries=[['含税实收',...amount('gross')],['真实营业收入（去税后）',...amount('revenue')],['产品成本',...amount('cost')],...root.DailyCore.FEES.map(fee=>{const next=after?.fees.find(item=>item.key===fee.key);return [fee.key==='royalty'?'版权费（按产品成本）':fee.name,before.fees.find(item=>item.key===fee.key).usd,next?.usd??null,after?.partial===true?next?.rmb??null:undefined]}),['实际物流成本',...amount('logistics')],['税前利润',...amount('pretax')],['所得税',...amount('tax')],['净利润',...amount('net')]];
  return entries.map(([label,oldUsd,newUsd,partialRmb])=>{
   const oldRmb=oldUsd*beforeFx,newRmb=partialRmb!==undefined?partialRmb:newUsd===null||afterFx===null?null:newUsd*afterFx;
   return {label,oldUsd,oldRmb,newUsd,newRmb,deltaUsd:newUsd===null?null:newUsd-oldUsd,deltaRmb:newRmb===null?null:newRmb-oldRmb};
  });
 }
 function marginDelta(before,after){return before===null||after===null?null:(after-before)*100;}
 function formatMarginDelta(before,after){
  const delta=marginDelta(before,after);
  return delta===null?'—':`${delta>0?'+':''}${delta.toFixed(2)}%`;
 }
 function valueClass(value){return typeof value!=='number'||!Number.isFinite(value)||value===0?'value-neutral':value>0?'value-positive':'value-negative';}
 const api={rows,marginDelta,formatMarginDelta,valueClass};root.CompareCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
