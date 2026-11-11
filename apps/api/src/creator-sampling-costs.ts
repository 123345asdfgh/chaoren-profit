import type {PoolClient} from 'pg';
import type {SamplingRecord} from './creator-sampling-core.js';

export const SAMPLING_COST_RATE = 0.4;
export const costNameKey = (name:string) => name.trim().replace(/\s+/gu,' ').toLowerCase();
export type CatalogCost = {id:string;name:string;chinaPrice:unknown;estimate?:{source?:string;chinaPrice?:unknown}|null};
export type CostLoader = (names:string[]) => Promise<CatalogCost[]>;
export type CostedSamplingRecord = SamplingRecord & {
 productId:string|null;chinaPrice:number|null;unitCostRmb:number|null;costEstimated:boolean;
 costStatus:'matched'|'missing-name'|'missing-product'|'missing-price';
};

function price(value:unknown):number|null{
 if(typeof value!=='number'&&typeof value!=='string'||typeof value==='string'&&!value.trim())return null;
 const amount=Number(value);
 return Number.isFinite(amount)&&amount>=0&&amount<=1e9?amount:null;
}

export async function loadCatalogCosts(db:Pick<PoolClient,'query'>,names:string[]):Promise<CatalogCost[]>{
 const keys=[...new Set(names.map(costNameKey).filter(Boolean))];
 if(!keys.length)return [];
 const {rows}=await db.query(`SELECT id,name,snapshot->'fields'->>'chinaPrice' AS china_price,
  snapshot->'samplingCostEstimate' AS estimate FROM profit.products WHERE name_key=ANY($1::text[])`,[keys]);
 return rows.map(row=>({id:row.id,name:row.name,chinaPrice:row.china_price,estimate:row.estimate}));
}

export function attachSamplingCosts(records:SamplingRecord[],products:CatalogCost[]):CostedSamplingRecord[]{
 const catalog=new Map(products.map(product=>[costNameKey(product.name),product]));
 return records.map(record=>{
  const key=costNameKey(record.product),product=catalog.get(key),chinaPrice=price(product?.chinaPrice);
  return {...record,productId:product?.id??null,chinaPrice,
   // Sampling costs always use the requested 40%, independent of per-order configuration.
   unitCostRmb:chinaPrice===null?null:chinaPrice*SAMPLING_COST_RATE,
   costEstimated:chinaPrice!==null&&product?.estimate?.source==='demo-sampling-cost'&&price(product.estimate.chinaPrice)===chinaPrice,
   costStatus:!key?'missing-name':!product?'missing-product':chinaPrice===null?'missing-price':'matched'};
 });
}
