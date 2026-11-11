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

test('sampling separates shipped products and creators from all planned records',()=>{
 const base={date:'2026-10-06',category:'盲盒',level:'L2',fulfilled:false};
 const records=[
  {...base,id:'1',creator:'alice',product:'已寄产品',quantity:2,shipped:true},
  {...base,id:'2',creator:'bob',product:'未寄产品',quantity:7,shipped:false},
  {...base,id:'3',creator:'alice',product:'已寄产品',quantity:3,shipped:true},
  {...base,id:'4',creator:'alice',product:'待补寄',quantity:4,level:'L4',shipped:false}
 ];
 const result=core.sampling(records);
 assert.equal(result.planned.creators,2);assert.equal(result.shipped.creators,1);assert.equal(result.unshipped.creators,2);
 assert.equal(result.shipped.quantity,5);assert.equal(result.shipped.productCount,1);
 assert.equal(result.unshipped.quantity,11);assert.equal(result.unshipped.productCount,2);
 assert.deepEqual(result.shipped.products.map(row=>row.name),['已寄产品']);
 assert.equal(result.shipped.tiers.find(row=>row.name==='L2').value,1);
 assert.equal(result.unshipped.tiers.find(row=>row.name==='L4').value,1);
 assert.equal(result.planned.quantity,result.shipped.quantity+result.unshipped.quantity);
});
test('sampling applies date and category filters before splitting shipment status',()=>{
 const base={creator:'alice',product:'商品',quantity:2,level:'L2'};
 const records=[
  {...base,id:'1',date:'2026-10-06',category:'盲盒',shipped:true},
  {...base,id:'2',date:'2026-10-06',category:'毛绒',shipped:false},
  {...base,id:'3',date:'2026-11-06',category:'盲盒',shipped:false}
 ];
 const filtered=core.filterRecords(records,{mode:'month',period:'2026-10',category:'blind'},core.categoriesFromData(records));
 const result=core.sampling(filtered);
 assert.equal(result.planned.creators,1);assert.equal(result.shipped.quantity,2);assert.equal(result.unshipped.recordCount,0);
});
test('sampling handles missing accounts, invalid quantities and no shipped records',()=>{
 const result=core.sampling([
  {id:'1',date:'2026-10-06',creator:'',product:'商品',quantity:2,shipped:true},
  {id:'2',date:'2026-10-06',creator:'bob',product:'商品',quantity:null,shipped:false},
  {id:'3',date:'2026-10-06',creator:'carol',product:'商品',quantity:3}
 ]);
 assert.equal(result.shipped.quantity,2);assert.equal(result.shipped.creators,0);assert.equal(result.shipped.missingCreator,1);
 assert.equal(result.unshipped.creators,2);assert.equal(result.unshipped.quantity,3);assert.equal(result.unshipped.invalidQuantity,1);
 for(const group of Object.values(core.sampling([]))){assert.equal(group.creators,0);assert.equal(group.quantity,0);assert.equal(group.recordCount,0)}
 const none=core.sampling([{id:'1',date:'2026-10-06',creator:'bob',product:'商品',quantity:4,shipped:false}]);
 assert.equal(none.shipped.productCount,0);assert.equal(none.shipped.quantity,0);assert.equal(none.unshipped.quantity,4);
});
