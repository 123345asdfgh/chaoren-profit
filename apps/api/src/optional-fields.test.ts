import {describe,expect,it,vi} from 'vitest';
vi.mock('./db.js',()=>({pool:{}}));
import {measurementSchema} from './measurements.js';
import {productSchema} from './products.js';
import {checkedSnapshot} from './snapshot.js';

describe('only specification code is required',()=>{
 it('accepts just a specification code in both product and measurement requests',()=>{
  const product=productSchema.parse({specCode:'  00001-A  '});
  expect(product).toMatchObject({specCode:'00001-A',name:'',productCode:'',attribute:'',length:null,width:null,height:null,weight:null});
  const body=measurementSchema.parse({specCode:'00001-A'});
  const checked=checkedSnapshot(body.snapshot);
  expect(checked.snapshot.fields.chinaPrice).toBe('');expect(checked.snapshot.input).toBeNull();expect(checked.result).toBeNull();
 });
 it('requires a nonblank specification code for every write schema',()=>{
  for(const specCode of [undefined,'','  ']){
   expect(productSchema.safeParse({specCode}).success).toBe(false);
   expect(measurementSchema.safeParse({specCode}).success).toBe(false);
  }
 });
 it('preserves partial data and blank amounts without converting them to zero',()=>{
  const {snapshot,result}=checkedSnapshot({fields:{chinaPrice:'100',logistics:'',promotion:'',length:'20',weight:''}});
  expect(snapshot.fields).toMatchObject({chinaPrice:'100',logistics:'',promotion:'',length:'20',weight:''});expect(result).toBeNull();
 });
 it('still rejects invalid provided values even when the rest is missing',()=>{
  for(const fields of [{chinaPrice:'-1'},{fx:'0'},{promotion:'101'},{logistics:'NaN'},{weight:'-2'},{currency:'CAD'}] as Record<string,string>[])expect(()=>checkedSnapshot({fields})).toThrow();
  expect(productSchema.safeParse({specCode:'1',length:0}).success).toBe(false);
 });
 it('calculates a complete profit without requiring optional product or shipping information',()=>{
  const checked=checkedSnapshot({fields:{chinaPrice:'100',salePrice:'40',buyerShipping:'0',receipt:'40',logistics:'70',currency:'RMB',fx:'6.8',multiplier:'2.8',costRate:'40',divisor:'1.13',tax:'25',promotion:'25',operation:'10',platform:'7',royalty:'7',labor:'3',other:'2'}});
  expect(checked.result?.netRmb).toBeTypeOf('number');expect(checked.snapshot.fields.attribute).toBe('');expect(checked.snapshot.fields.length).toBeUndefined();
 });
});
