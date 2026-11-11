import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {z} from 'zod';

export function record(row:Record<string,unknown>){return {id:row.id,productId:row.product_id??null,name:row.name,category:row.category,specCode:row.spec_code,productCode:row.product_code,operatorName:row.operator_name,market:row.market,snapshot:row.snapshot,previousSnapshot:row.previous_snapshot,previousSavedAt:row.previous_saved_at,previousVersion:row.previous_version,measurementSequence:row.measurement_sequence==null?null:Number(row.measurement_sequence),version:Number(row.version),netRmb:row.net_rmb==null?null:Number(row.net_rmb),netUsd:row.net_usd==null?null:Number(row.net_usd),margin:row.margin==null?null:Number(row.margin),savedAt:row.updated_at,createdAt:row.created_at}}

export function versionGaps(versions:number[]){
 const missing:string[]=[];let expected=1;
 for(const version of [...new Set(versions)].sort((a,b)=>a-b)){
  if(version>expected)missing.push(version-expected===1?String(expected):`${expected}–${version-1}`);
  expected=version+1;
 }
 return missing;
}

function archivedRecord(row:Record<string,unknown>,currentVersion:number){
 return {...record(row.data as Record<string,unknown>),version:Number(row.version),savedAt:row.saved_at,isCurrent:Number(row.version)===currentVersion};
}

export function registerRecordVersionRoutes(app:FastifyInstance,prefix:string,db:Pick<Pool,'query'>){
 app.get(prefix+'/records/:id/versions',async(request,reply)=>{
  const id=z.uuid().parse((request.params as {id:string}).id);
  // Accept old product archive links, but new links always identify one order.
  let current=(await db.query('SELECT * FROM profit.records WHERE id=$1',[id])).rows[0];
  if(!current)current=(await db.query('SELECT * FROM profit.records WHERE product_id=$1 ORDER BY updated_at DESC,id DESC LIMIT 1',[id])).rows[0];
  if(!current)return reply.code(404).send({error:'测算记录不存在'});
  const {rows}=await db.query('SELECT * FROM profit.record_versions WHERE record_id=$1 ORDER BY version ASC',[current.id]);
  const records=rows.map(row=>archivedRecord(row,Number(current.version)));
  return {record:record(current),product:{id:current.product_id??current.id,name:current.name,specCode:current.spec_code,productCode:current.product_code,attribute:current.category,snapshot:current.snapshot},records,missingVersions:versionGaps(records.map(row=>row.version))};
 });
 app.get(prefix+'/records/:id/versions/:version',async(request,reply)=>{
  const {id,version}=z.object({id:z.uuid(),version:z.coerce.number().int().positive()}).parse(request.params);
  const {rows}=await db.query('SELECT v.*,r.version AS current_version FROM profit.record_versions v JOIN profit.records r ON r.id=v.record_id WHERE v.record_id=$1 AND v.version=$2',[id,version]);
  if(!rows.length)return reply.code(404).send({error:'该历史版本不存在或旧数据已被覆盖'});
  return archivedRecord(rows[0],Number(rows[0].current_version));
 });
}
