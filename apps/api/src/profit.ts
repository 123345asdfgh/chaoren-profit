import {z} from 'zod';
const amount=z.number().finite().min(0).max(1e9),rate=z.number().finite().min(0).max(100);
export const inputSchema=z.object({chinaPrice:amount,salePrice:amount,buyerShipping:amount,receipt:z.number().finite().min(0).max(2e9),logistics:amount,currency:z.enum(['RMB','USD']),fx:amount.positive(),multiplier:amount,divisor:amount.min(1),costRate:rate,tax:rate,promotion:rate,operation:rate,platform:rate,royalty:rate,labor:rate,other:rate});
export type ProfitInput=z.infer<typeof inputSchema>;
export function calculate(raw:ProfitInput){const i=inputSchema.parse(raw);if(Math.abs(i.salePrice+i.buyerShipping-i.receipt)>Math.max(1e-8,i.receipt*1e-12))throw Error('最终实收与商品售价、买家运费不一致');
const grossUsd=i.receipt,grossRmb=grossUsd*i.fx,revenueRmb=grossRmb/i.divisor,revenueUsd=revenueRmb/i.fx;
const costRmb=i.chinaPrice*i.costRate/100,costUsd=costRmb/i.fx,logisticsRmb=i.currency==='RMB'?i.logistics:i.logistics*i.fx,logisticsUsd=logisticsRmb/i.fx;
const fees=([['promotion','推广费'],['operation','代运营'],['platform','平台佣金'],['royalty','版权费'],['labor','人工成本'],['other','其他费用']] as const).map(([key,name])=>{const basis=key==='royalty'?'产品成本':'真实营业收入',rate=i[key];return {key,name,rate,basis,usd:(key==='royalty'?costUsd:revenueUsd)*rate/100,rmb:(key==='royalty'?costRmb:revenueRmb)*rate/100}});
const feeUsd=fees.reduce((sum,fee)=>sum+fee.usd,0),pretaxUsd=revenueUsd-costUsd-logisticsUsd-feeUsd,taxUsd=Math.max(0,pretaxUsd)*i.tax/100,netUsd=pretaxUsd-taxUsd;
return {grossUsd,grossRmb,revenueRmb,revenueUsd,costRmb,costUsd,logisticsRmb,logisticsUsd,fees,feeUsd,rateTotal:fees.filter(f=>f.key!=='royalty').reduce((s,f)=>s+f.rate,0),pretaxUsd,taxUsd,netUsd,netRmb:netUsd*i.fx,margin:revenueUsd>0?netUsd/revenueUsd:null};}
