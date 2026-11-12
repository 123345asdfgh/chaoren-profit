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

test('sampling cost sums per-product unit cost times shipped quantity, excluding unshipped rows',()=>{
 const records=[
  {shipped:true,quantity:2,unitCostRmb:40,costEstimated:true},
  {shipped:true,quantity:3,unitCostRmb:20,costEstimated:false},
  {shipped:false,quantity:10,unitCostRmb:40,costEstimated:true}
 ];
 assert.deepEqual(core.costStatistics(records),{totalRmb:140,pricedRows:2,missingPriceRows:0,invalidQuantityRows:0,estimatedRows:1,partial:false,hasValue:true});
 assert.equal(core.costStatistics([{shipped:true,quantity:3,unitCostRmb:39.996}]).totalRmb,119.99,'round only the final total, not each unit cost');
});
test('sampling cost follows date and category filters and reports incomplete totals',()=>{
 const records=[
  {id:'1',date:'2026-10-06',category:'盲盒',shipped:true,quantity:2,unitCostRmb:40},
  {id:'2',date:'2026-11-06',category:'盲盒',shipped:true,quantity:5,unitCostRmb:40},
  {id:'3',date:'2026-10-06',category:'毛绒',shipped:true,quantity:3,unitCostRmb:10}
 ];
 const filtered=core.filterRecords(records,{mode:'month',period:'2026-10',category:'blind'},core.categoriesFromData(records));
 assert.equal(core.costStatistics(filtered).totalRmb,80);
 const partial=core.costStatistics([...filtered,{shipped:true,quantity:2,unitCostRmb:null},{shipped:true,quantity:null,unitCostRmb:20}]);
 assert.equal(partial.totalRmb,80);assert.equal(partial.partial,true);assert.equal(partial.missingPriceRows,1);assert.equal(partial.invalidQuantityRows,1);
 assert.equal(core.costStatistics([{shipped:true,quantity:1,unitCostRmb:null}]).hasValue,false);
 assert.equal(core.costStatistics([]).totalRmb,0);assert.equal(core.costStatistics([]).hasValue,true);
 assert.equal(core.costStatistics([{shipped:true,quantity:0,unitCostRmb:null}]).partial,false);
});

test('product filter narrows every dashboard aggregate and clears cleanly',()=>{
 const records=[
  {id:'1',date:'2026-10-06',category:'盲盒',creator:'alice',product:'猫猫盲盒',quantity:2,unitCostRmb:10,shipped:true,fulfilled:true},
  {id:'2',date:'2026-10-06',category:'盲盒',creator:'bob',product:'蜘蛛侠盲盒',quantity:3,unitCostRmb:20,shipped:true,fulfilled:false},
  {id:'3',date:'2026-10-06',category:'盲盒',creator:'alice',product:'猫猫盲盒',quantity:1,shipped:false,fulfilled:false},
  {id:'4',date:'2026-11-06',category:'盲盒',creator:'carol',product:'猫猫盲盒',quantity:5,unitCostRmb:10,shipped:true,fulfilled:true}
 ];
 const categories=core.categoriesFromData(records);
 const options={mode:'month',period:'2026-10',category:'all',product:'猫猫盲盒'};
 const filtered=core.filterRecords(records,options,categories);
 assert.equal(filtered.length,2);
 const result=core.sampling(filtered);
 assert.equal(result.planned.creators,1);
 assert.equal(result.shipped.quantity,2);
 assert.equal(result.unshipped.quantity,1);
 assert.equal(core.costStatistics(filtered).totalRmb,20);
 assert.deepEqual(core.fulfillment(filtered),{due:1,actual:1,rate:100});
 const all=core.filterRecords(records,{...options,product:''},categories);
 assert.equal(all.length,3);
});

test('multiple categories are combined before product, period and dashboard statistics are applied',()=>{
 const records=[
  {id:'1',date:'2026-10-06',category:'盲盒',creator:'alice',product:'商品甲',quantity:2,unitCostRmb:10,shipped:true,fulfilled:true},
  {id:'2',date:'2026-10-06',category:'毛绒',creator:'bob',product:'商品甲',quantity:3,unitCostRmb:20,shipped:true,fulfilled:false},
  {id:'3',date:'2026-10-06',category:'常规',creator:'carol',product:'商品乙',quantity:7,unitCostRmb:30,shipped:true,fulfilled:true},
  {id:'4',date:'2026-11-06',category:'盲盒',creator:'dave',product:'商品甲',quantity:5,unitCostRmb:10,shipped:true,fulfilled:true}
 ];
 const categories=core.categoriesFromData(records);
 const options={mode:'month',period:'2026-10',categories:['blind','plush'],product:'商品甲'};
 const filtered=core.filterRecords(records,options,categories);
 assert.deepEqual(filtered.map(record=>record.id),['1','2']);
 assert.equal(core.sampling(filtered).shipped.quantity,5);
 assert.equal(core.costStatistics(filtered).totalRmb,80);
 assert.deepEqual(core.fulfillment(filtered),{due:2,actual:1,rate:50});
 assert.equal(core.filterRecords(records,{...options,categories:null,product:''},categories).length,3);
 assert.equal(core.filterRecords(records,{...options,categories:[]},categories).length,0);
 assert.equal(core.filterRecords(records,{...options,categories:['unknown']},categories).length,0);
 assert.deepEqual(core.filterRecords(records,{...options,mode:'day',period:'2026-10-06'},categories),filtered);
 assert.equal(core.filterRecords(records,{...options,mode:'all'},categories).length,3);
});


test('an invalid row contributes to no dashboard metric and can recover after repair',()=>{
 const valid={id:'valid',date:'2026-10-21',creator:'alice',level:'L2',product:'商品甲',category:'盲盒',quantity:2,unitCostRmb:40,shipped:true,fulfilled:false,invalidReasons:[]};
 const invalid={...valid,id:'invalid',creator:'bob',product:'商品乙',quantity:5,fulfilled:true,invalidReasons:['缺少达人等级']};
 const secondary={...invalid,id:'secondary',sourceType:'secondary'};
 const rows=[valid,invalid,secondary];
 assert.equal(core.aggregate(rows).recordCount,1);
 assert.equal(core.sampling(rows).planned.creators,1);
 assert.equal(core.sampling(rows).shipped.quantity,2);
 assert.equal(core.sampling(rows).shipped.productCount,1);
 assert.equal(core.costStatistics(rows).totalRmb,80);
 assert.deepEqual(core.fulfillment(rows),{due:1,actual:0,rate:0});
 const repaired={...invalid,invalidReasons:[]};
 assert.equal(core.sampling([valid,repaired]).shipped.quantity,7);
 assert.equal(core.costStatistics([valid,repaired]).totalRmb,280);
 assert.deepEqual(core.fulfillment([valid,repaired]),{due:2,actual:1,rate:50});
});
test('invalid records with unknown dates stay available for diagnostic review',()=>{
 const record={date:'',category:'',product:'商品',invalidReasons:['日期缺失或无效']};
 const options={mode:'month',period:'2026-10',categories:['blind'],product:''};
 assert.equal(core.filterRecords([record],options,core.defaults).length,0);
 assert.equal(core.filterRecords([record],{...options,includeUnknown:true},core.defaults).length,1);
});
