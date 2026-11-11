import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {createRequire} from 'node:module';
import {pool} from './db.js';

const normalizeName=(value:string)=>value.trim().replace(/\s+/gu,' ');
const nameSchema=z.string().transform(normalizeName).pipe(z.string().max(200)).default('');
const {normalizeCategory}=createRequire(import.meta.url)('../../web/public/legacy/freight-core.js') as {normalizeCategory:(value:unknown)=>unknown};
const attributeSchema=z.preprocess(normalizeCategory,z.enum(['常规','盲盒','毛绒']));
const measure=z.number().finite().min(.000001).max(1e6);
const optionalMeasure=z.preprocess(value=>value===''||value===undefined?null:value,measure.nullable());
const codeSchema=z.string().trim().min(1).max(200);
export const productSchema=z.strictObject({name:nameSchema,specCode:codeSchema,productCode:z.string().trim().max(200).default(''),attribute:z.union([z.literal(''),attributeSchema]).default(''),length:optionalMeasure,width:optionalMeasure,height:optionalMeasure,weight:optionalMeasure});
const codeQuery=z.string().trim().max(200).default('');
const querySchema=z.object({q:z.string().max(200).default('').transform(normalizeName),specCode:codeQuery,productCode:codeQuery,attribute:z.union([z.literal(''),attributeSchema]).default(''),page:z.coerce.number().int().min(1).max(100000).default(1),limit:z.coerce.number().int().pipe(z.union([z.literal(10),z.literal(20),z.literal(50)])).default(10)});
const duplicateMessage='该商品已录入，请修改已有商品资料。';
function duplicateError(error:unknown){
 const issue=error as {code?:string;constraint?:string};
 if(issue.code!=='23505')return null;
 return issue.constraint==='products_spec_code_unique'?'规格编码已存在，请搜索已有商品。':issue.constraint==='products_product_code_unique'?'商品编码已存在，请使用其他编码，或修改已有商品资料。':duplicateMessage;
}
export function product(row:Record<string,unknown>){
 const result=(row.snapshot as {result?:{netRmb?:number|null;netUsd?:number|null;margin?:number|null}}|null)?.result;
 const amount=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:null;
  return {netRmb:amount(result?.netRmb),netUsd:amount(result?.netUsd),margin:amount(result?.margin),measurementCount:typeof row.measurement_count==='number'?row.measurement_count:0,id:row.id,name:row.name,specCode:row.spec_code,productCode:row.product_code,attribute:normalizeCategory(row.attribute),...Object.fromEntries(['length','width','height','weight'].map(key=>[key,row[key]==null?null:Number(row[key])])),snapshot:row.snapshot??null,createdAt:row.created_at,updatedAt:row.updated_at};
}
export function registerProductRoutes(app:FastifyInstance,prefix:string){
 app.get(prefix+'/products',async request=>{
  const query=querySchema.parse(request.query),values=[query.q,query.attribute,query.specCode,query.productCode];
  const where="($1='' OR strpos(name_key,lower($1))>0) AND ($2='' OR attribute=$2) AND ($3='' OR strpos(lower(spec_code),lower($3))>0) AND ($4='' OR strpos(lower(product_code),lower($4))>0)";
  const [items,count]=await Promise.all([
   pool.query('SELECT p.* FROM profit.products p WHERE '+where.replaceAll('name_key','p.name_key').replaceAll('attribute','p.attribute').replaceAll('spec_code','p.spec_code').replaceAll('product_code','p.product_code')+' ORDER BY p.updated_at DESC,p.id DESC LIMIT $5 OFFSET $6',[...values,query.limit,(query.page-1)*query.limit]),
   pool.query('SELECT count(*)::int AS total FROM profit.products WHERE '+where,values)
  ]);
  return {products:items.rows.map(product),total:count.rows[0].total,page:query.page,limit:query.limit};
 });
 app.get(prefix+'/products/suggestions',async request=>{
  const {q}=z.object({q:codeSchema}).parse(request.query);
  const {rows}=await pool.query('SELECT p.*,(SELECT count(*)::int FROM profit.records r WHERE r.product_id=p.id) AS measurement_count FROM profit.products p WHERE strpos(lower(p.spec_code),lower($1))>0 ORDER BY (lower(btrim(p.spec_code))=lower($1)) DESC,lower(p.spec_code),p.id LIMIT 8',[q]);
  return {products:rows.map(product)};
 });
 app.get(prefix+'/products/:id',async(request,reply)=>{
  const id=z.uuid().parse((request.params as {id:string}).id);
  const {rows}=await pool.query('SELECT p.*,(SELECT count(*)::int FROM profit.records r WHERE r.product_id=p.id) AS measurement_count FROM profit.products p WHERE p.id=$1',[id]);
  if(!rows.length)return reply.code(404).send({error:'商品资料不存在，请刷新列表。'});
  return product(rows[0]);
 });
 app.post(prefix+'/products',async(request,reply)=>{
  const body=productSchema.parse(request.body);
  try{
   const {rows}=await pool.query('INSERT INTO profit.products(name,attribute,length,width,height,weight,spec_code,product_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[body.name,body.attribute,body.length,body.width,body.height,body.weight,body.specCode,body.productCode]);
   return reply.code(201).send(product(rows[0]));
  }catch(error){const message=duplicateError(error);if(message)return reply.code(409).send({error:message});throw error;}
 });
 app.patch(prefix+'/products/:id',async(request,reply)=>{
  const id=z.uuid().parse((request.params as {id:string}).id),body=productSchema.parse(request.body);
  try{
   const {rows}=await pool.query('UPDATE profit.products SET name=$2,attribute=$3,length=$4,width=$5,height=$6,weight=$7,spec_code=$8,product_code=$9,updated_at=now() WHERE id=$1 RETURNING *',[id,body.name,body.attribute,body.length,body.width,body.height,body.weight,body.specCode,body.productCode]);
   if(!rows.length)return reply.code(404).send({error:'商品资料不存在，请刷新列表。'});
   return product(rows[0]);
  }catch(error){const message=duplicateError(error);if(message)return reply.code(409).send({error:message});throw error;}
 });
 app.delete(prefix+'/products/:id',async(request,reply)=>{
  const id=z.uuid().parse((request.params as {id:string}).id);
  const {rows}=await pool.query('DELETE FROM profit.products WHERE id=$1 RETURNING id,name',[id]);
  if(!rows.length)return reply.code(404).send({error:'商品资料不存在，请刷新列表。'});
  return {deleted:true,id:rows[0].id,name:rows[0].name};
 });
}
