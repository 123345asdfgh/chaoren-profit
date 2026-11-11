const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('./time-core.js');
test('洛杉矶冬夏与跨日',()=>{
assert.equal(core.local(core.resolve('2026-01-15T20:00','America/Los_Angeles')[0],'Asia/Shanghai'),'2026-01-16T12:00:00');
assert.equal(core.local(core.resolve('2026-07-15T20:00','America/Los_Angeles')[0],'Asia/Shanghai'),'2026-07-16T11:00:00');
});
test('北京反向换算',()=>{assert.equal(core.local(core.resolve('2026-07-16T08:00','Asia/Shanghai')[0],'America/New_York'),'2026-07-15T20:00:00');});
test('夏令时跳时',()=>{assert.deepEqual(core.resolve('2026-03-08T02:30','America/New_York'),[]);});
test('夏令时重复',()=>{const results=core.resolve('2026-11-01T01:30','America/New_York');assert.equal(results.length,2);assert.equal(results[1]-results[0],3600000);});
test('跨年和非法日期',()=>{assert.equal(core.local(core.resolve('2026-12-31T23:00','America/Los_Angeles')[0],'Asia/Shanghai'),'2027-01-01T15:00:00');assert.deepEqual(core.resolve('2026-02-30T12:00','Asia/Shanghai'),[]);});
test('凤凰城、夏威夷固定偏移',()=>{for(const month of ['01','07']){assert.equal(core.offset(Date.parse(`2026-${month}-15T12:00Z`),'America/Phoenix'),-420);assert.equal(core.offset(Date.parse(`2026-${month}-15T12:00Z`),'Pacific/Honolulu'),-600);}});

test('时段背景在06/12/17/19点精确切换，午夜仍为夜晚',()=>{
 for(const [time,expected]of [['00:00','night'],['05:59:59','night'],['06:00','morning'],['11:59:59','morning'],['12:00','noon'],['16:59:59','noon'],['17:00','dusk'],['18:59:59','dusk'],['19:00','night'],['23:59:59','night']]){
  const timestamp=core.resolve('2026-10-31T'+time,'Asia/Shanghai')[0];assert.equal(core.phase(timestamp,'Asia/Shanghai'),expected);
 }
});
test('同一时刻中美背景分别根据当地时间计算',()=>{
 const timestamp=core.resolve('2026-10-31T13:30','Asia/Shanghai')[0];assert.equal(core.phase(timestamp,'Asia/Shanghai'),'noon');assert.equal(core.phase(timestamp,'America/Los_Angeles'),'night');assert.equal(core.phase(timestamp,'America/New_York'),'night');
});
test('时区变化和夏令时重复不误用设备时区',()=>{
 const timestamp=Date.parse('2026-10-31T13:00:00Z');assert.equal(core.phase(timestamp,'Asia/Shanghai'),'night');assert.equal(core.phase(timestamp,'America/Los_Angeles'),'morning');assert.equal(core.phase(timestamp,'Pacific/Honolulu'),'night');
 for(const repeated of core.resolve('2026-11-01T01:30','America/New_York'))assert.equal(core.phase(repeated,'America/New_York'),'night');
});
