const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('./core.js');
test('fulfillment responds to period/category filters and deduplicates creator-date pairs',()=>{
 const base={creator:'alice',quantity:1,product:'商品',level:'L2',shipped:true};
 const records=[{...base,id:'1',date:'2026-10-06',category:'盲盒',fulfilled:true},{...base,id:'2',date:'2026-10-06',category:'盲盒',fulfilled:true},{...base,id:'3',date:'2026-11-06',category:'毛绒',fulfilled:false},{...base,id:'4',date:'2026-11-06',category:'毛绒',creator:'bob',shipped:false,fulfilled:false}];
 const categories=core.categoriesFromData(records,['常规']);
 assert.equal(categories.find(c=>c.source==='常规').name,'常规');
 assert.deepEqual(core.fulfillment(records),{due:2,actual:1,rate:50});
 const october=core.filterRecords(records,{mode:'month',period:'2026-10',category:'all'},categories);
 assert.deepEqual(core.fulfillment(october),{due:1,actual:1,rate:100});
 assert.deepEqual(core.fulfillment(core.filterRecords(records,{mode:'all',period:'',category:'plush'},categories)),{due:1,actual:0,rate:0});
 assert.deepEqual(core.fulfillment([]),{due:0,actual:0,rate:null});
});
