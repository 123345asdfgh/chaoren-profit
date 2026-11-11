const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('./core.js');
const {rows,marginDelta}=require('./compare-core.js');
const input={...core.DEFAULTS,chinaPrice:100,receipt:41.18,logistics:50.1,currency:'RMB'};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
test('identical scenarios have zero differences for all profit items',()=>{
 const result=core.calculate(input);const entries=rows(result,result,6.8,6.8);assert.equal(entries.length,13);for(const row of entries){near(row.deltaUsd,0);near(row.deltaRmb,0);}near(marginDelta(result.margin,result.margin),0);
});
test('changed price compares net profits, royalty cost basis stays unchanged',()=>{
 const before=core.calculate(input),after=core.calculate({...input,receipt:50});const entries=rows(before,after,6.8,6.8);const net=entries.find(row=>row.label==='净利润');near(net.deltaRmb,after.netRmb-before.netRmb);near(net.deltaUsd,after.netUsd-before.netUsd);near(entries.find(row=>row.label.includes('版权费')).deltaRmb,0);
});
test('each scenario uses its own exchange rate for RMB differences',()=>{
 const before=core.calculate(input),after=core.calculate({...input,fx:7.5});const net=rows(before,after,6.8,7.5).find(row=>row.label==='净利润');near(net.oldRmb,before.netRmb);near(net.newRmb,after.netRmb);near(net.deltaRmb,after.netRmb-before.netRmb);
});
test('invalid new scenario leaves baseline available without stale differences',()=>{
 const before=core.calculate(input);for(const row of rows(before,null,6.8,6.8)){assert.equal(row.newUsd,null);assert.equal(row.newRmb,null);assert.equal(row.deltaRmb,null);assert.equal(row.deltaUsd,null);assert.ok(Number.isFinite(row.oldRmb));}
});
test('zero revenue rate is not applicable and rate differences are percentage points',()=>{
 assert.equal(marginDelta(null,.2),null);assert.equal(marginDelta(.2,null),null);near(marginDelta(.15,.2),5);near(marginDelta(.2,-.1),-30);
});
test('baseline is a stored snapshot and is never mutated or recalculated',()=>{
 const before=core.calculate(input);before.netUsd=123;before.netRmb=836.4;const snapshot=JSON.stringify(before);const after=core.calculate({...input,receipt:1});const net=rows(before,after,6.8,6.8).find(row=>row.label==='净利润');assert.equal(net.oldUsd,123);assert.equal(JSON.stringify(before),snapshot);assert.equal(after.taxUsd,0);
});
