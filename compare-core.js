(function(root){
 'use strict';
 function rows(before,after,beforeFx,afterFx){
  const amount=(key)=>[before[key],after?.[key]??null];
  const entries=[['含税实收',...amount('grossUsd')],['真实营业收入（去税后）',...amount('revenueUsd')],['产品成本',...amount('costUsd')],...root.DailyCore.FEES.map(fee=>[fee.key==='royalty'?'版权费（按产品成本）':fee.name,before.fees.find(item=>item.key===fee.key).usd,after?.fees.find(item=>item.key===fee.key)?.usd??null]),['实际物流成本',...amount('logisticsUsd')],['税前利润',...amount('pretaxUsd')],['所得税',...amount('taxUsd')],['净利润',...amount('netUsd')]];
  return entries.map(([label,oldUsd,newUsd])=>({label,oldUsd,oldRmb:oldUsd*beforeFx,newUsd,newRmb:newUsd===null?null:newUsd*afterFx,deltaUsd:newUsd===null?null:newUsd-oldUsd,deltaRmb:newUsd===null?null:newUsd*afterFx-oldUsd*beforeFx}));
 }
 function marginDelta(before,after){return before===null||after===null?null:(after-before)*100;}
 const api={rows,marginDelta};root.CompareCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
