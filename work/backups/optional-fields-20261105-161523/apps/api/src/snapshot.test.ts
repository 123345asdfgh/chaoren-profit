import {createRequire} from 'node:module';
import {describe,expect,it} from 'vitest';
import {checkedSnapshot,snapshotSchema} from './snapshot.js';
import {calculate} from './profit.js';
import {freightConfigSchema} from './freight-config.js';
const core=createRequire(import.meta.url)('../../web/public/legacy/freight-core.js');
const config=()=>freightConfigSchema.parse(structuredClone(core.DEFAULT_CONFIG));
const fields={length:'20',width:'15',height:'10',weight:'0.2',packType:'naked',store:'广州店铺',attribute:'普货',chinaPrice:'100',salePrice:'41.18',buyerShipping:'0',receipt:'41.18',logistics:'70',currency:'RMB',fx:'6.8',multiplier:'2.8',costRate:'40',divisor:'1.13',tax:'25',promotion:'20',operation:'10',platform:'7',royalty:'4',labor:'3',other:'2',zone:'America/Los_Angeles'};
describe('saved shipping inputs and version configuration',()=>{
 it('stores inputs and canonical estimate separately from the manually entered cost',()=>{
  const checked=checkedSnapshot(snapshotSchema.parse({fields,freight:config(),quote:{cny:999}}));
  expect(checked.snapshot.fields.length).toBe('20');expect(checked.snapshot.fields.store).toBe('广州店铺');expect(checked.snapshot.quote?.cny).toBe(58.92);
  expect(checked.snapshot.input.logistics).toBe(70);expect(checked.result.logisticsRmb).toBe(70);expect(checked.result).toEqual(calculate(checked.snapshot.input));
 });
 it('uses the saved custom configuration without changing global defaults',()=>{
  const freight=config();freight.channels.USPH.volumeDivisor=8000;freight.hongKong.extraFee=3;
  const checked=checkedSnapshot({fields:{...fields,store:'香港店铺'},freight});
  expect(checked.snapshot.freight).toEqual(freight);expect(checked.snapshot.quote?.extra).toBe(3);expect(config().hongKong.extraFee).toBe(1);
 });
 it('accepts old snapshots without fabricating missing shipping values',()=>{
  const legacy=Object.fromEntries(Object.entries(fields).filter(([key])=>!['length','width','height','weight','packType','store'].includes(key)));
  const checked=checkedSnapshot(snapshotSchema.parse({fields:legacy}));expect(checked.snapshot.fields.length).toBeUndefined();expect(checked.snapshot.freight).toBeUndefined();expect(checked.result.logisticsRmb).toBe(70);
 });
 it('allows a manually confirmed cost when the package needs a manual quote',()=>{
  const checked=checkedSnapshot({fields:{...fields,weight:'100'},freight:config()});expect(checked.snapshot.quote).toBeNull();expect(checked.result.logisticsRmb).toBe(70);
 });
 it('rejects invalid shipping inputs and incomplete configurations',()=>{
  for(const change of [{length:'-1'},{weight:'NaN'},{store:'其他店铺'},{packType:'invalid'}])expect(()=>checkedSnapshot({fields:{...fields,...change},freight:config()})).toThrow();
  expect(snapshotSchema.safeParse({fields,freight:{channels:{}}}).success).toBe(false);
 });
});
