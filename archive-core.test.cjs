const test=require('node:test');
const assert=require('node:assert/strict');
const {KEY,read,save,remove,search}=require('./archive-core.js');
const identity={name:'数码宝贝盲盒',specCode:'0001-A',productCode:'000028'};
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}
test('empty storage returns no records',()=>assert.deepEqual(read(storage()),[]));
test('persists full snapshot and preserves text codes after reload',()=>{
 const local=storage(),snapshot={fields:{chinaPrice:'100',fx:'6.8'},result:{netRmb:39.02},quote:{result:{cny:50.1}},adoptedQuote:{code:'USPH'}};
 save(local,identity,snapshot);
 const records=read(local);assert.equal(records.length,1);assert.deepEqual(records[0].snapshot,snapshot);assert.equal(records[0].specCode,'0001-A');assert.equal(records[0].productCode,'000028');assert.ok(records[0].savedAt);
});
test('search matches any identity field partially and case insensitively',()=>{
 const local=storage();save(local,identity,{});const records=read(local);
 for(const query of ['宝贝','  001-a  ','0028'])assert.equal(search(records,query).length,1);
 assert.equal(search(records,'不存在').length,0);
});
test('same three identity fields replace the old snapshot and retain its id',()=>{
 const local=storage();const first=save(local,identity,{value:1});save(local,identity,{value:2});const records=read(local);assert.equal(records.length,1);assert.equal(records[0].snapshot.value,2);assert.equal(records[0].id,first.id);
});
test('empty or whitespace search never exposes stored records',()=>{
 const local=storage();save(local,identity,{});for(const query of ['', '  ', '\t'])assert.deepEqual(search(read(local),query),[]);
});
test('any different identity field creates a separate product',()=>{
 const local=storage();save(local,identity,{});for(const key of ['name','specCode','productCode'])save(local,{...identity,[key]:identity[key]+'new'},{});assert.equal(read(local).length,4);
});
test('identity overwrite trims whitespace but remains case sensitive',()=>{
 const local=storage();save(local,identity,{value:1});save(local,{...identity,name:' '+identity.name+' ',specCode:' '+identity.specCode+' '},{value:2});assert.equal(read(local).length,1);save(local,{...identity,specCode:'0001-a'},{});assert.equal(read(local).length,2);
});
test('saving consolidates identical legacy duplicates but preserves unrelated records',()=>{
 const local=storage();const first=save(local,identity,{value:1});const other=save(local,{...identity,name:'other'},{});const records=read(local);records.push({...first,id:'legacy-duplicate',snapshot:{value:0}});local.setItem(KEY,JSON.stringify({version:1,records}));save(local,identity,{value:3});const updated=read(local);assert.equal(updated.length,2);assert.equal(updated[0].snapshot.value,3);assert.equal(updated[1].id,other.id);
});
test('delete removes only the selected record and persists after read',()=>{
 const local=storage();const first=save(local,identity,{});const other=save(local,{...identity,name:'other'},{});assert.equal(remove(local,first.id),true);assert.deepEqual(read(local).map(record=>record.id),[other.id]);assert.equal(remove(local,first.id),false);assert.equal(remove(local,other.id),true);assert.deepEqual(read(local),[]);
});
test('failed delete or overwrite leaves stored data intact',()=>{
 const local=storage();const record=save(local,identity,{value:1});const before=local.getItem(KEY);local.setItem=()=>{throw Error('QuotaExceededError');};assert.throws(()=>remove(local,record.id));assert.throws(()=>save(local,identity,{value:2}));assert.equal(local.getItem(KEY),before);
});
test('deleting refuses to replace corrupt storage',()=>{
 const local=storage();local.setItem(KEY,'broken');assert.throws(()=>remove(local,'any'));assert.equal(local.getItem(KEY),'broken');
});
test('invalid identities never write',()=>{
 const local=storage();for(const name of ['', '   ', '字'.repeat(201)])assert.throws(()=>save(local,{...identity,name},{}));assert.deepEqual(read(local),[]);
});
test('corrupt data is not silently overwritten',()=>{
 const local=storage();for(const raw of ['bad json','{"version":2,"records":[]}','{"version":1,"records":[{}]}']){local.setItem(KEY,raw);assert.throws(()=>save(local,identity,{}));assert.equal(local.getItem(KEY),raw);}
});
test('quota or denied storage errors propagate without removing old data',()=>{
 const local=storage();save(local,identity,{value:1});const before=local.getItem(KEY);local.setItem=()=>{throw Error('QuotaExceededError');};assert.throws(()=>save(local,identity,{}),/Quota/);assert.equal(local.getItem(KEY),before);assert.throws(()=>read({getItem(){throw Error('SecurityError');}}),/Security/);
});
