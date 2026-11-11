import type {PoolClient} from 'pg';
import {z} from 'zod';
import {checkedSnapshot,snapshotSchema} from './snapshot.js';
import {productSchema} from './products.js';
import {defaultFieldsSchema} from './user-settings.js';

const text=z.string().trim().min(1).max(200);
const optionalText=z.string().trim().max(200).default('');
export const measurementSchema=z.object({name:optionalText,specCode:text,productCode:optionalText,productId:z.uuid().nullable().optional(),market:z.literal('US').default('US'),snapshot:snapshotSchema.default({fields:{}}),defaultFields:defaultFieldsSchema.optional()});
type Measurement=z.infer<typeof measurementSchema>;
type Snapshot=ReturnType<typeof checkedSnapshot>['snapshot']&{identity?:Record<string,string>};
const problem=(message:string,statusCode=409)=>Object.assign(Error(message),{statusCode});

// The caller owns the transaction so the product and its measurement commit together.
export async function syncMeasuredProduct(client:PoolClient,body:{name:string;specCode:string;productCode:string;snapshot:Snapshot;productId?:string|null}){
 const fields=body.snapshot.fields;
 const data=productSchema.parse({name:body.name,specCode:body.specCode,productCode:body.productCode,attribute:fields.attribute,...Object.fromEntries(['length','width','height','weight'].map(key=>[key,fields[key]?Number(fields[key]):null]))});
 await client.query('SELECT pg_advisory_xact_lock(hashtextextended(lower(btrim($1)),0))',[data.specCode]);
 const existing=body.productId
  ?await client.query('SELECT id FROM profit.products WHERE id=$1 FOR UPDATE',[body.productId])
  :await client.query('SELECT id FROM profit.products WHERE lower(btrim(spec_code))=lower(btrim($1)) FOR UPDATE',[data.specCode]);
 if(body.productId&&!existing.rows.length)throw problem('商品资料已变更，请重新搜索后保存。');
 const values=[data.name,data.specCode,data.productCode,data.attribute,data.length,data.width,data.height,data.weight,JSON.stringify(body.snapshot)];
 const saved=existing.rows.length
  ?await client.query('UPDATE profit.products SET name=$1,spec_code=$2,product_code=$3,attribute=$4,length=$5,width=$6,height=$7,weight=$8,snapshot=$9::jsonb,updated_at=now() WHERE id=$10 RETURNING id',[...values,existing.rows[0].id])
  :await client.query('INSERT INTO profit.products(name,spec_code,product_code,attribute,length,width,height,weight,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING id',values);
 return saved.rows[0].id as string;
}

// Catalog edits replace the complete product snapshot without writing order history.
export async function saveCatalogMeasurement(client:PoolClient,id:string,body:Measurement){
 const checked=checkedSnapshot(body.snapshot);
 const identity={name:body.name,category:checked.snapshot.fields.attribute,specCode:body.specCode,productCode:body.productCode,market:body.market};
 const snapshot={...checked.snapshot,identity};
 await syncMeasuredProduct(client,{...body,snapshot,productId:id});
 const {rows}=await client.query('SELECT * FROM profit.products WHERE id=$1',[id]);
 return rows[0] as Record<string,unknown>;
}

export async function saveMeasurement(client:PoolClient,id:string|null,body:Measurement){
 let current:Record<string,unknown>|undefined;
 if(id){
  const selected=await client.query('SELECT * FROM profit.records WHERE id=$1 AND market=$2 FOR UPDATE',[id,body.market]);
  current=selected.rows[0];if(!current)throw problem('记录不存在',404);
 }
 const checked=checkedSnapshot(body.snapshot),category=checked.snapshot.fields.attribute;
 const identity={name:body.name,category,specCode:body.specCode,productCode:body.productCode,market:body.market};
 const snapshot={...checked.snapshot,identity};
 let productId=(current?.product_id as string|undefined)||body.productId;
 if(current&&!productId){
  const original=await client.query('SELECT id FROM profit.products WHERE lower(btrim(spec_code))=lower(btrim($1))',[current.spec_code]);
  productId=original.rows[0]?.id;
 }
 productId=await syncMeasuredProduct(client,{...body,snapshot,productId});
 const result=checked.result;
 const values=[body.name,body.specCode,body.productCode,category,JSON.stringify(snapshot),result?.netRmb??null,result?.netUsd??null,result?.margin??null,body.market,productId];
 const saved=id
  ?await client.query('UPDATE profit.records SET name=$1,spec_code=$2,product_code=$3,category=$4,previous_snapshot=snapshot,previous_saved_at=updated_at,previous_version=version,snapshot=$5::jsonb,version=version+1,net_rmb=$6,net_usd=$7,margin=$8,product_id=$10,updated_at=now() WHERE id=$11 AND market=$9 RETURNING *',[...values,id])
  :await client.query('INSERT INTO profit.records(name,spec_code,product_code,category,snapshot,net_rmb,net_usd,margin,market,product_id) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10) RETURNING *',values);
 return saved.rows[0] as Record<string,unknown>;
}

export function measurementConflict(error:unknown){
 const issue=error as {code?:string;constraint?:string};
 if(issue.code!=='23505')return null;
 if(issue.constraint==='products_spec_code_unique')return '规格编码已属于其他商品，请重新搜索或使用其他规格编码。';
 if(issue.constraint==='products_product_code_unique')return '商品编码已属于其他商品，请使用其他编码。';
 return '商品名称已存在，请使用其他名称或搜索已有商品。';
}
