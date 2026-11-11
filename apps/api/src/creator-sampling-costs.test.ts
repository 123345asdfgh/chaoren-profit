import {describe,it,expect} from 'vitest';
import {attachSamplingCosts,costNameKey} from './creator-sampling-costs.js';
import type {SamplingRecord} from './creator-sampling-core.js';
const record=(product:string):SamplingRecord=>({id:'1',date:'2026-10-06',creator:'alice',level:'L2',product,category:'盲盒',quantity:2,shipped:true,fulfilled:false});
describe('sampling product costs',()=>{
 it('joins catalog names with whitespace and case normalization and uses a fixed 40 percent',()=>{
  const result=attachSamplingCosts([record('  SNOOPY   手提袋 ')],[{id:'catalog-1',name:'snoopy 手提袋',chinaPrice:'99.99'}])[0];
  expect(result).toMatchObject({productId:'catalog-1',chinaPrice:99.99,costEstimated:false,costStatus:'matched'});
  expect(result.unitCostRmb).toBeCloseTo(39.996);expect(costNameKey('  A  B ')).toBe('a b');
 });
 it('does not silently treat missing, invalid or negative prices as zero and never guesses a similar product',()=>{
  for(const value of ['',null,undefined,'abc','-1',NaN,Infinity,1e10]){
   expect(attachSamplingCosts([record('商品')],[{id:'1',name:'商品',chinaPrice:value}])[0]).toMatchObject({chinaPrice:null,unitCostRmb:null,costStatus:'missing-price'});
  }
  expect(attachSamplingCosts([record('商品A')],[{id:'1',name:'商品AB',chinaPrice:100}])[0].costStatus).toBe('missing-product');
  expect(attachSamplingCosts([record('')],[])[0].costStatus).toBe('missing-name');
  expect(attachSamplingCosts([record('商品')],[{id:'1',name:'商品',chinaPrice:'0'}])[0]).toMatchObject({unitCostRmb:0,costStatus:'matched'});
 });
 it('marks only the stored demo price as estimated and removes the flag after replacement',()=>{
  const product={id:'1',name:'商品',chinaPrice:'100',estimate:{source:'demo-sampling-cost',chinaPrice:100}};
  expect(attachSamplingCosts([record('商品')],[product])[0].costEstimated).toBe(true);
  expect(attachSamplingCosts([record('商品')],[{...product,chinaPrice:'120'}])[0]).toMatchObject({costEstimated:false,unitCostRmb:48});
 });
});
