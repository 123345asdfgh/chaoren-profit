import {describe,expect,it} from 'vitest';
import {calculate} from './profit.js';
const base={chinaPrice:100,salePrice:41.18,buyerShipping:0,receipt:41.18,logistics:50.1,currency:'RMB' as const,fx:6.8,multiplier:2.8,costRate:40,divisor:1.13,tax:25,promotion:20,operation:10,platform:7,royalty:4,labor:3,other:2};
describe('profit API validation and canonical totals',()=>{
 it('matches original browser calculator',()=>{const result=calculate(base);expect(result.netRmb).toBeCloseTo(39.02,1);expect(result.margin).toBeCloseTo(0.1575,3);expect(result.fees.find(f=>f.key==='royalty')?.rmb).toBeCloseTo(1.6)});
 it('does not tax a loss',()=>{expect(calculate({...base,receipt:0,salePrice:0}).taxUsd).toBe(0)});
 it('rejects inconsistent receipt',()=>{expect(()=>calculate({...base,receipt:50})).toThrow('不一致')});
});
