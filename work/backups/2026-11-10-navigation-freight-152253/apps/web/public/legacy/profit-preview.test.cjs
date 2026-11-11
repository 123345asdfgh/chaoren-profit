const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('./core.js');
const comparison=require('./compare-core.js');
const input={...core.DEFAULTS,chinaPrice:100,salePrice:40,buyerShipping:5,receipt:45,logistics:70,currency:'RMB'};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

test('complete previews match the saved calculation for either logistics currency',()=>{
 for(const currency of ['RMB','USD']){
  const values={...input,currency},saved=core.calculate(values),preview=core.preview(values);
  for(const key of ['grossUsd','grossRmb','revenueUsd','revenueRmb','costUsd','costRmb','logisticsUsd','logisticsRmb','feeUsd','pretaxUsd','taxUsd','netUsd','netRmb','margin'])near(preview[key],saved[key]);
  for(const fee of saved.fees){const actual=preview.fees.find(item=>item.key===fee.key);near(actual.usd,fee.usd);near(actual.rmb,fee.rmb);}
 }
});

test('clearing any single fee only clears that fee and dependent totals',()=>{
 const complete=core.preview(input);
 for(const {key}of core.FEES){
  const result=core.preview({...input,[key]:null});
  assert.equal(result.fees.find(fee=>fee.key===key).usd,null);
  assert.equal(result.fees.find(fee=>fee.key===key).rmb,null);
  for(const fee of result.fees.filter(fee=>fee.key!==key))near(fee.usd,complete.fees.find(item=>item.key===fee.key).usd);
  for(const name of ['grossUsd','revenueUsd','costUsd','logisticsUsd'])near(result[name],complete[name]);
  for(const name of ['pretaxUsd','pretaxRmb','taxUsd','taxRmb','netUsd','netRmb','margin'])assert.equal(result[name],null);
 }
});

test('missing income tax preserves pretax profit and zero fee rates remain valid',()=>{
 const result=core.preview({...input,tax:null,promotion:0});
 assert.equal(result.fees.find(fee=>fee.key==='promotion').usd,0);
 assert.ok(Number.isFinite(result.pretaxUsd));assert.ok(Number.isFinite(result.pretaxRmb));
 assert.equal(result.taxUsd,null);assert.equal(result.netRmb,null);
 near(core.preview(input).netRmb,core.calculate(input).netRmb);
});

test('missing exchange rate retains independently known amounts in each currency',()=>{
 const result=core.preview({...input,fx:null});
 assert.equal(result.costRmb,40);assert.equal(result.logisticsRmb,70);
 assert.equal(result.costUsd,null);assert.equal(result.logisticsUsd,null);
 near(result.revenueUsd,45/1.13);assert.equal(result.revenueRmb,null);
 assert.equal(result.fees.find(fee=>fee.key==='royalty').rmb,2.8);
 const usd=core.preview({...input,fx:null,currency:'USD'});
 assert.equal(usd.logisticsUsd,70);assert.equal(usd.logisticsRmb,null);
});

test('invalid values and inconsistent receipts never become zero or stale profit',()=>{
 for(const promotion of [null,'',NaN,Infinity,-1,101])assert.equal(core.preview({...input,promotion}).netUsd,null);
 assert.equal(core.preview({...input,receipt:46}).grossUsd,null);
 assert.equal(core.preview({...input,divisor:0}).revenueUsd,null);
});

test('comparison preserves baseline and unaffected rows while editing a fee',()=>{
 const baseline=core.calculate(input),saved=JSON.stringify(baseline);
 const result=comparison.rows(baseline,core.preview({...input,promotion:null}),input.fx,input.fx);
 assert.equal(result.length,13);
 for(const row of result){
  assert.ok(Number.isFinite(row.oldUsd));assert.ok(Number.isFinite(row.oldRmb));
  if(['推广费','税前利润','所得税','净利润'].includes(row.label)){
   assert.equal(row.newUsd,null);assert.equal(row.newRmb,null);assert.equal(row.deltaUsd,null);assert.equal(row.deltaRmb,null);
  }else{near(row.deltaUsd,0);near(row.deltaRmb,0);}
 }
 assert.equal(JSON.stringify(baseline),saved);
});

test('comparison never converts a missing exchange rate into zero RMB',()=>{
 const baseline=core.calculate(input),result=comparison.rows(baseline,core.preview({...input,fx:null}),input.fx,null);
 const cost=result.find(row=>row.label==='产品成本'),logistics=result.find(row=>row.label==='实际物流成本'),income=result.find(row=>row.label==='真实营业收入（去税后）');
 assert.equal(cost.newRmb,40);assert.equal(cost.newUsd,null);near(cost.deltaRmb,0);
 assert.equal(logistics.newRmb,70);assert.equal(logistics.newUsd,null);
 assert.equal(income.newRmb,null);assert.equal(income.deltaRmb,null);near(income.deltaUsd,0);
});
