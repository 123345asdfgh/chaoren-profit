const {test}=require('node:test');
const assert=require('node:assert/strict');
const FreightCore=require('./freight-core.js');
const {quote,DEFAULT_CONFIG,cloneConfig}=FreightCore;
const item={length:20,width:15,height:10,weight:.2,attribute:'潮玩',store:'广州店铺',naked:false};

test('包裹按渠道计费，毛绒仅按实重',()=>{
 assert.deepEqual([quote(item).code,quote(item).cny],['USPH',50.1]);
 assert.deepEqual([quote({...item,attribute:'带电'}).code,quote({...item,attribute:'带电'}).cny],['USFC',51.6]);
 const plush=quote({...item,attribute:'毛绒'});
 assert.equal(plush.code,'USMPPK');assert.equal(plush.chargeWeight,.2);assert.equal(plush.cny,47.2);
 assert.deepEqual([quote({...item,attribute:'液体'}).code,quote({...item,attribute:'液体'}).cny],['USTM',65]);
});

test('裸货先按属性换算尺寸和重量，再选渠道',()=>{
 const toy=quote({...item,naked:true});
 assert.deepEqual([toy.length,toy.width,toy.height,toy.weight,toy.chargeWeight,toy.cny],[25,18.75,12.5,.28,.59,72.18]);
 const plush=quote({...item,attribute:'毛绒',naked:true});
 assert.deepEqual([plush.length,plush.weight,plush.chargeWeight,plush.cny],[15,.24,.24,51.64]);
});

test('香港店铺非特敏转 USFC 并加 1 元，液体保留 USTM',()=>{
 const hongKong=quote({...item,attribute:'毛绒',store:'香港店铺'});
 assert.deepEqual([hongKong.code,hongKong.mode,hongKong.cny,hongKong.extra],['USFC','max',52.6,1]);
 const liquid=quote({...item,attribute:'液体',store:'香港店铺'});
 assert.deepEqual([liquid.code,liquid.cny],['USTM',66]);
});

test('统一配置可以改变路由、裸货系数、费率和店铺附加费',()=>{
 const config=cloneConfig(DEFAULT_CONFIG);
 config.routes['潮玩']='USFC';config.pack['潮玩'].size=1;config.pack['潮玩'].weight=1;
 config.channels.USFC.tiers[1].rate=120;config.hongKong.extraFee=3;
 const result=quote({...item,store:'香港店铺',naked:true},config);
 assert.equal(result.code,'USFC');assert.equal(result.chargeWeight,.3);
 assert.equal(result.cny,60);
 assert.equal(quote(item).cny,50.1);
});

test('超过10kg仍需人工询价，空属性使用常规报价',()=>{
 assert.throws(()=>quote({...item,weight:10.01}),/10kg/);
 assert.throws(()=>quote({...item,weight:20}),/10kg/);
 const config=cloneConfig(DEFAULT_CONFIG);config.maxWeight=.25;
 assert.throws(()=>quote(item,config),/0.25kg/);
 assert.equal(quote({...item,attribute:''}).cny,quote({...item,attribute:'常规'}).cny);
});

test('three business categories preserve the matching original freight rules',()=>{
 assert.deepEqual(FreightCore.CATEGORIES,['常规','盲盒','毛绒']);
 for(const [current,previous] of [['常规','普货'],['盲盒','潮玩'],['毛绒','毛绒']]){
  for(const naked of [true,false])for(const store of ['广州店铺','香港店铺']){
   const input={length:20,width:15,height:10,weight:.2,naked,store};
   const expected=FreightCore.quote({...input,attribute:previous},FreightCore.DEFAULT_CONFIG);
   const actual=FreightCore.quote({...input,attribute:current},FreightCore.DEFAULT_CONFIG);
   assert.equal(actual.cny,expected.cny);assert.equal(actual.code,expected.code);assert.equal(actual.attribute,current);
  }
 }
});
