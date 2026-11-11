(function (root) {
  const FEES = [{key:'promotion',name:'推广费',rate:25},{key:'operation',name:'代运营',rate:10},{key:'platform',name:'平台佣金',rate:7},{key:'royalty',name:'版权费',rate:7},{key:'labor',name:'人工成本',rate:3},{key:'other',name:'其他费用',rate:2}];
  const DEFAULTS = {fx:6.8,multiplier:2.8,costRate:40,divisor:1.13,tax:25,...Object.fromEntries(FEES.map(fee=>[fee.key,fee.rate]))};
  function requireNumber(value,label,min=0,max=1e9) {
    if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(label+'填写无效');
    return value;
  }
  function recommend(chinaPrice,multiplier,fx) {
    requireNumber(chinaPrice,'国内组合价');requireNumber(multiplier,'售价倍率',0,1000);requireNumber(fx,'汇率',.000001);
    return chinaPrice*multiplier/fx;
  }
  function calculate(input) {
    for(const key of ['chinaPrice','logistics'])requireNumber(input[key],key);
    requireNumber(input.receipt,'最终实收',0,2e9);
    requireNumber(input.fx,'汇率',.000001);
    requireNumber(input.divisor,'去税系数',1);
    for(const key of ['costRate','tax',...FEES.map(fee=>fee.key)])requireNumber(input[key],key,0,100);
    if(!['RMB','USD'].includes(input.currency))throw Error('请选择物流币种');
    const grossUsd=input.receipt,grossRmb=grossUsd*input.fx;
    const revenueRmb=grossRmb/input.divisor,revenueUsd=revenueRmb/input.fx;
    const costRmb=input.chinaPrice*input.costRate/100,costUsd=costRmb/input.fx;
    const logisticsRmb=input.currency==='RMB'?input.logistics:input.logistics*input.fx;
    const logisticsUsd=logisticsRmb/input.fx;
    const fees=FEES.map(fee=>{
      const isRoyalty=fee.key==='royalty';
      return {...fee,rate:input[fee.key],basis:isRoyalty?'产品成本':'真实营业收入',usd:(isRoyalty?costUsd:revenueUsd)*input[fee.key]/100,rmb:(isRoyalty?costRmb:revenueRmb)*input[fee.key]/100};
    });
    const feeUsd=fees.reduce((sum,fee)=>sum+fee.usd,0);
    const pretaxUsd=revenueUsd-costUsd-logisticsUsd-feeUsd;
    const taxUsd=Math.max(0,pretaxUsd)*input.tax/100;
    const netUsd=pretaxUsd-taxUsd;
    return {grossUsd,grossRmb,revenueRmb,revenueUsd,costRmb,costUsd,logisticsRmb,logisticsUsd,fees,feeUsd,rateTotal:fees.filter(fee=>fee.key!=='royalty').reduce((sum,fee)=>sum+fee.rate,0),pretaxUsd,taxUsd,netUsd,netRmb:netUsd*input.fx,margin:revenueUsd>0?netUsd/revenueUsd:null};
  }
  // Preview each line from its own inputs; missing values never become zero.
  function preview(raw) {
    const value=(key,min=0,max=1e9)=>typeof raw[key]==='number'&&Number.isFinite(raw[key])&&raw[key]>=min&&raw[key]<=max?raw[key]:null;
    const combine=(fn,...values)=>values.every(value=>value!==null)?fn(...values):null;
    const sum=values=>combine((...items)=>items.reduce((total,value)=>total+value,0),...values);
    const fx=value('fx',.000001),divisor=value('divisor',1),costRate=value('costRate',0,100),taxRate=value('tax',0,100);
    let grossUsd=value('receipt',0,2e9);
    const sale=value('salePrice'),shipping=value('buyerShipping');
    if(sale!==null&&shipping!==null&&grossUsd!==null&&Math.abs(sale+shipping-grossUsd)>Math.max(1e-8,grossUsd*1e-12))grossUsd=null;
    const grossRmb=combine((amount,rate)=>amount*rate,grossUsd,fx);
    const revenueRmb=combine((amount,divide)=>amount/divide,grossRmb,divisor);
    const revenueUsd=fx!==null?combine((amount,rate)=>amount/rate,revenueRmb,fx):combine((amount,divide)=>amount/divide,grossUsd,divisor);
    const costRmb=combine((price,rate)=>price*rate/100,value('chinaPrice'),costRate),costUsd=combine((cost,rate)=>cost/rate,costRmb,fx);
    const logistics=value('logistics');
    const logisticsRmb=raw.currency==='RMB'?logistics:raw.currency==='USD'?combine((amount,rate)=>amount*rate,logistics,fx):null;
    const logisticsUsd=raw.currency==='USD'?logistics:raw.currency==='RMB'?combine((amount,rate)=>amount/rate,logistics,fx):null;
    const fees=FEES.map(fee=>{
      const rate=value(fee.key,0,100),royalty=fee.key==='royalty';
      const usd=combine((basis,rate)=>basis*rate/100,royalty?costUsd:revenueUsd,rate);
      const rmb=usd!==null&&fx!==null?usd*fx:combine((basis,rate)=>basis*rate/100,royalty?costRmb:revenueRmb,rate);
      return {...fee,rate,usd,rmb};
    });
    const feeUsd=sum(fees.map(fee=>fee.usd)),feeRmb=sum(fees.map(fee=>fee.rmb));
    const pretaxUsd=combine((revenue,cost,logistics,fees)=>revenue-cost-logistics-fees,revenueUsd,costUsd,logisticsUsd,feeUsd);
    const pretaxRmb=pretaxUsd!==null&&fx!==null?pretaxUsd*fx:combine((revenue,cost,logistics,fees)=>revenue-cost-logistics-fees,revenueRmb,costRmb,logisticsRmb,feeRmb);
    const taxUsd=combine((profit,rate)=>Math.max(0,profit)*rate/100,pretaxUsd,taxRate);
    const taxRmb=taxUsd!==null&&fx!==null?taxUsd*fx:combine((profit,rate)=>Math.max(0,profit)*rate/100,pretaxRmb,taxRate);
    const netUsd=combine((profit,tax)=>profit-tax,pretaxUsd,taxUsd);
    const netRmb=netUsd!==null&&fx!==null?netUsd*fx:combine((profit,tax)=>profit-tax,pretaxRmb,taxRmb);
    const margin=netUsd!==null&&revenueUsd!==null&&revenueUsd>0?netUsd/revenueUsd:null;
    return {partial:true,grossUsd,grossRmb,revenueUsd,revenueRmb,costUsd,costRmb,logisticsUsd,logisticsRmb,fees,feeUsd,pretaxUsd,pretaxRmb,taxUsd,taxRmb,netUsd,netRmb,margin,taxRate};
  }
  const api={FEES,DEFAULTS,recommend,calculate,preview};root.DailyCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
