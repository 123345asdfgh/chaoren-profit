const {test}=require('node:test');const assert=require('node:assert/strict');
const {quote,FREIGHT_DEFAULTS,clone}=require('./freight-core.js');
const item={length:20,width:15,height:10,weight:.2,attribute:'潮玩',store:'广州店铺',naked:false};
function near(actual,expected){assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);}
test('原工具潮玩样例50.10RMB',()=>{const result=quote(item);assert.equal(result.code,'USPH');assert.equal(result.volumeWeight,.3);assert.equal(result.chargeWeight,.3);near(result.cny,50.1);});
test('香港非特敏强制USFC，附加1RMB',()=>{const result=quote({...item,store:'香港店铺'});assert.equal(result.code,'USFC');near(result.cny,52.6);assert.equal(result.extra,1);});
test('毛绒仅按实重47.20RMB，香港改计材积',()=>{const result=quote({...item,attribute:'毛绒'});assert.equal(result.code,'USMPPK');assert.equal(result.chargeWeight,.2);near(result.cny,47.2);near(quote({...item,attribute:'毛绒',store:'香港店铺'}).cny,52.6);});
test('液体香港仍USTM，65/66RMB',()=>{near(quote({...item,attribute:'液体'}).cny,65);const result=quote({...item,attribute:'液体',store:'香港店铺'});assert.equal(result.code,'USTM');near(result.cny,66);});
test('裸货潮玩尺寸与重量系数及舍入',()=>{const result=quote({...item,naked:true});assert.equal(result.length,25);assert.equal(result.width,18.75);assert.equal(result.height,12.5);assert.equal(result.weight,.28);assert.equal(result.volumeWeight,.59);near(result.cny,72.18);});
test('裸货毛绒压缩包装',()=>{const result=quote({...item,naked:true,attribute:'毛绒'});assert.equal(result.length,15);assert.equal(result.weight,.24);near(result.cny,51.64);});
test('最小计费重0.05及最大10kg',()=>{const result=quote({...item,length:1,width:1,height:1,weight:.001});assert.equal(result.chargeWeight,.05);near(result.cny,26.85);near(quote({...item,weight:10}).cny,1032);assert.throws(()=>quote({...item,weight:10.01}),/10kg/);});
test('重量档位边界按原工具四舍五入',()=>{const small={...item,length:1,width:1,height:1};near(quote({...small,weight:.224}).cny,.22*97+22);near(quote({...small,weight:.226}).cny,.23*97+21);near(quote({...small,weight:.45}).cny,.45*97+19);near(quote({...small,weight:.46}).cny,.46*102+12);});
test('所有商品路由',()=>{for(const [attribute,code]of Object.entries({'普货':'USPH','带电':'USFC','带磁':'USFC','洞洞包':'USMPPK','包袋':'USMPPK','未分类':'USPH'}))assert.equal(quote({...item,attribute}).code,code);});
test('异常和超材积报价拒绝',()=>{for(const bad of [{weight:0},{length:NaN},{height:-1},{width:Infinity},{length:100,width:100,height:100}])assert.throws(()=>quote({...item,...bad}));});
test('统一配置可修改体积重、票费、包装系数和商品路由',()=>{const config=clone(FREIGHT_DEFAULTS);config.volumeDivisor=20000;config.channels.USPH.fees[0]=30;const regular=quote({...item,config});assert.equal(regular.volumeWeight,.15);near(regular.cny,.2*97+30);config.pack['潮玩']=[2,2];const naked=quote({...item,naked:true,config});assert.equal(naked.length,40);assert.equal(naked.weight,.4);config.rules['潮玩']='USFC';assert.equal(quote({...item,config}).code,'USFC');near(quote(item).cny,50.1);});
