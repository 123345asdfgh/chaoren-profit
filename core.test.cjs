const {test}=require('node:test');const assert=require('node:assert/strict');
const {DEFAULTS,recommend,calculate}=require('./core.js');
const baseline={...DEFAULTS,chinaPrice:100,receipt:35,logistics:50.1,currency:'RMB'};
function near(actual,expected){assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);}
test('参考美国价=国内价*2.8/6.8',()=>{near(recommend(100,2.8,6.8),41.1764705882353);near(recommend(100,3,6),50);});
test('以最终实收去税算利润，不重复减去税差额',()=>{
 const result=calculate(baseline);near(result.grossRmb,238);near(result.revenueRmb,238/1.13);near(result.costRmb,40);near(result.feeUsd,35/1.13*.42+40/6.8*.04);near(result.netRmb,(238/1.13*.58-40-40*.04-50.1)*.75);near(result.margin,result.netRmb/result.revenueRmb);
});
test('超过30也不自动减收入；只使用最终实收',()=>{const result=calculate({...baseline,receipt:40});near(result.grossUsd,40);near(result.revenueUsd,40/1.13);});
test('参考定价倍率不会改变既定成交利润',()=>{near(calculate({...baseline,multiplier:9}).netUsd,calculate(baseline).netUsd);});
test('RMB物流和USD物流等价',()=>{near(calculate({...baseline,currency:'USD',logistics:50.1/6.8}).netUsd,calculate(baseline).netUsd);});
test('修改汇率保留RMB运费原额',()=>{const result=calculate({...baseline,fx:8});near(result.logisticsRmb,50.1);near(result.logisticsUsd,50.1/8);});
test('零收入扣成本，净利率不适用',()=>{const result=calculate({...baseline,receipt:0});assert.equal(result.margin,null);near(result.netRmb,-91.7);assert.equal(result.taxUsd,0);});
test('亏损所得税为0',()=>{const result=calculate({...baseline,receipt:1});assert.ok(result.netUsd<0);assert.equal(result.taxUsd,0);});
test('去税系数和成本税率均可改',()=>{const result=calculate({...baseline,divisor:1,costRate:50,tax:0});near(result.revenueUsd,35);near(result.costRmb,50);near(result.netUsd,35*.58-50/6.8-50*.04/6.8-50.1/6.8);});
test('非法输入拒绝',()=>{for(const bad of [{fx:0},{receipt:NaN},{divisor:.9},{tax:101},{logistics:-1},{currency:'EUR'}])assert.throws(()=>calculate({...baseline,...bad}));assert.throws(()=>recommend(100,2.8,0));});

test('版权基数为产品成本而非收入，默认收入扣点合计42%',()=>{
 const result=calculate(baseline),royalty=result.fees.find(fee=>fee.key==='royalty');near(royalty.rmb,1.6);near(royalty.usd,1.6/6.8);assert.equal(royalty.basis,'产品成本');assert.equal(result.rateTotal,42);
 near(calculate({...baseline,receipt:70}).fees.find(fee=>fee.key==='royalty').rmb,1.6);
 near(calculate({...baseline,costRate:50,royalty:10}).fees.find(fee=>fee.key==='royalty').rmb,5);
 near(calculate({...baseline,chinaPrice:0}).fees.find(fee=>fee.key==='royalty').rmb,0);
});

test('结算汇率6.7同步作用于参考售价和人民币利润换算',()=>{near(recommend(100,2.8,6.7),280/6.7);const result=calculate({...baseline,fx:6.7});near(result.grossRmb,35*6.7);near(result.netRmb,result.netUsd*6.7);near(result.logisticsRmb,50.1);});
