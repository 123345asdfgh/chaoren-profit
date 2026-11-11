import {createRequire} from 'node:module';
import {z} from 'zod';
import {calculate,inputSchema} from './profit.js';
import {freightConfigSchema} from './freight-config.js';

export const profitFieldKeys=['attribute','chinaPrice','salePrice','buyerShipping','receipt','logistics','currency','fx','multiplier','costRate','divisor','tax','promotion','operation','platform','royalty','labor','other','zone'] as const;
export const shippingFieldKeys=['length','width','height','weight','packType','store'] as const;
export const fieldKeys=[...profitFieldKeys,...shippingFieldKeys] as const;
export const snapshotSchema=z.object({
 fields:z.record(z.string(),z.string()).refine(fields=>profitFieldKeys.every(key=>typeof fields[key]==='string'),'测算字段缺失'),
 freight:freightConfigSchema.optional()
});
type FreightConfig=z.infer<typeof freightConfigSchema>;
export type FreightQuote={code:string;mode:string;store:string;attribute:string;length:number;width:number;height:number;weight:number;volumeWeight:number;chargeWeight:number;rate:number;fee:number;extra:number;cny:number;naked:boolean};
const freightCore=createRequire(import.meta.url)('../../web/public/legacy/freight-core.js') as {quote:(input:Record<string,unknown>,config:FreightConfig)=>FreightQuote};
const numericKeys=['chinaPrice','salePrice','buyerShipping','receipt','logistics','fx','multiplier','costRate','divisor','tax','promotion','operation','platform','royalty','labor','other'] as const;
export function checkedSnapshot(snapshot:z.infer<typeof snapshotSchema>){
 const fields:Record<string,string>=Object.fromEntries(fieldKeys.filter(key=>snapshot.fields[key]!==undefined).map(key=>[key,snapshot.fields[key]]));
 const numeric=Object.fromEntries(numericKeys.map(key=>[key,Number(fields[key])]));
 for(const key of numericKeys)if(fields[key]==='')throw Object.assign(Error('必填测算字段为空: '+key),{statusCode:400});
 for(const key of ['length','width','height','weight'] as const){
  const value=fields[key];
  if(value!==undefined&&value!==''&&!z.coerce.number().finite().min(.000001).max(1e6).safeParse(value).success)throw Object.assign(Error('物流输入无效：'+key),{statusCode:400});
 }
 for(const [key,values] of [['packType',['parcel','naked']],['store',['广州店铺','香港店铺']]] as const){
  if(fields[key]!==undefined&&fields[key]!==''&&!(values as readonly string[]).includes(fields[key]))throw Object.assign(Error('物流选项无效：'+key),{statusCode:400});
 }
 const input=inputSchema.parse({...numeric,currency:fields.currency}),result=calculate(input);
 let quote:FreightQuote|null=null;
 if(snapshot.freight&&['length','width','height','weight','packType','store'].every(key=>fields[key])){
  // The estimate is retained separately. Profit always uses the entered logistics cost.
  try{quote=freightCore.quote({...Object.fromEntries(['length','width','height','weight'].map(key=>[key,Number(fields[key])])),attribute:fields.attribute,store:fields.store,naked:fields.packType==='naked'},snapshot.freight)}catch{/* An unquoted package can still have a manually confirmed logistics cost. */}
 }
 return {snapshot:{fields,input,result,...(snapshot.freight?{freight:snapshot.freight,quote}:{})},result};
}
