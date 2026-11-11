import {z} from 'zod';

const channels=['USPH','USFC','USMPPK','USTM'] as const;
const attributes=['普货','潮玩','带电','带磁','毛绒','洞洞包','包袋','液体'] as const;
const positive=z.number().finite().min(.001).max(1e6);
const nonnegative=z.number().finite().min(0).max(1e6);
const tier=z.strictObject({min:positive,max:positive,rate:nonnegative,fee:nonnegative}).refine(t=>t.min<=t.max);
const channel=z.strictObject({mode:z.enum(['max','actual']),volumeDivisor:positive,minWeight:positive,tiers:z.array(tier).min(1).max(20)}).refine(c=>{
 const sorted=[...c.tiers].sort((a,b)=>a.min-b.min);return sorted.every((t,i)=>!i||t.min>sorted[i-1].max);
},'重量档不能重叠');
export const freightConfigSchema=z.strictObject({
 maxWeight:positive,
 channels:z.record(z.enum(channels),channel),
 routes:z.record(z.enum(attributes),z.enum(channels)),
 pack:z.record(z.enum(attributes),z.strictObject({size:positive,weight:positive})),
 hongKong:z.strictObject({overrideChannel:z.enum(channels),preserveChannel:z.enum(channels),extraFee:nonnegative})
});
