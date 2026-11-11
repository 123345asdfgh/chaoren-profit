import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import {z,ZodError} from 'zod';
import {pool} from './db.js';
import {checkedSnapshot,snapshotSchema} from './snapshot.js';
import {exportHistoryWorkbook} from './history-export.js';
import {registerProductRoutes,product} from './products.js';
import {measurementSchema,saveMeasurement,saveCatalogMeasurement,syncMeasuredProduct,measurementConflict} from './measurements.js';
import {registerUserSettingsRoutes,saveUserSettings,initializeUserSettings} from './user-settings.js';

const app=Fastify({logger:{level:process.env.LOG_LEVEL||'info'},bodyLimit:256*1024});
await app.register(cookie);
const prefix='/api/profit';
const text=(max=200)=>z.string().trim().min(1).max(max);
const categoriesSchema=z.preprocess(value=>value===undefined?[]:Array.isArray(value)?value:[value],z.array(z.string().trim().min(1).max(100)).max(30));
const searchSchema=z.object({q:z.string().max(200).default(''),specCode:z.string().max(200).default(''),productCode:z.string().max(200).default(''),category:categoriesSchema,operator:z.string().max(80).default(''),from:z.iso.date().optional(),to:z.iso.date().optional(),page:z.coerce.number().int().min(1).max(100000).default(1),limit:z.coerce.number().int().default(10).pipe(z.union([z.literal(10),z.literal(20),z.literal(50)]))});

function originAllowed(request:import('fastify').FastifyRequest){const origin=request.headers.origin;if(!origin)return true;try{const source=new URL(origin);return source.host===request.headers.host||source.origin===(process.env.WEB_ORIGIN||'http://127.0.0.1:8081')}catch{return false}}
app.addHook('preHandler',async(request,reply)=>{if(['POST','PUT','PATCH','DELETE'].includes(request.method)&&!originAllowed(request))return reply.code(403).send({error:'请求来源不匹配'})});
app.setErrorHandler((error,request,reply)=>{const conflict=measurementConflict(error);if(conflict)return reply.code(409).send({error:conflict});if(error instanceof ZodError)return reply.code(400).send({error:'参数无效',details:error.issues});request.log.error(error);const issue=error as Error&{statusCode?:number};reply.code(issue.statusCode||500).send({error:issue.statusCode&&issue.statusCode<500?issue.message:'服务器暂时不可用'})});

function record(row:Record<string,unknown>){return {id:row.id,productId:row.product_id??null,name:row.name,category:row.category,specCode:row.spec_code,productCode:row.product_code,operatorName:row.operator_name,market:row.market,snapshot:row.snapshot,previousSnapshot:row.previous_snapshot,previousSavedAt:row.previous_saved_at,previousVersion:row.previous_version,version:row.version,netRmb:row.net_rmb==null?null:Number(row.net_rmb),netUsd:row.net_usd==null?null:Number(row.net_usd),margin:row.margin===null?null:Number(row.margin),savedAt:row.updated_at,createdAt:row.created_at}}

app.get(prefix+'/health',async()=>({ok:true}));
registerProductRoutes(app,prefix);
const userSettings=registerUserSettingsRoutes(app,prefix,pool);

const recordWhere="($1='' OR name ILIKE '%'||$1||'%') AND ($2='' OR spec_code ILIKE '%'||$2||'%') AND ($3='' OR product_code ILIKE '%'||$3||'%') AND (cardinality($4::text[])=0 OR category=ANY($4::text[])) AND ($5='' OR operator_name ILIKE '%'||$5||'%') AND ($6::date IS NULL OR updated_at >= ($6::date::timestamp AT TIME ZONE 'Asia/Shanghai')) AND ($7::date IS NULL OR updated_at < (($7::date + 1)::timestamp AT TIME ZONE 'Asia/Shanghai'))";
function searchValues(q:z.infer<typeof searchSchema>){return [q.q,q.specCode,q.productCode,q.category,q.operator,q.from||null,q.to||null]}
app.get(prefix+'/records',async(request)=>{const q=searchSchema.parse(request.query),values=[...searchValues(q),q.limit,(q.page-1)*q.limit];const [items,count]=await Promise.all([pool.query('SELECT * FROM profit.records WHERE '+recordWhere+' ORDER BY updated_at DESC,id DESC LIMIT $8 OFFSET $9',values),pool.query('SELECT count(*)::int AS total FROM profit.records WHERE '+recordWhere,values.slice(0,7))]);return {records:items.rows.map(record),total:count.rows[0].total,page:q.page,limit:q.limit}});
app.get(prefix+'/categories',async()=>{const {rows}=await pool.query("SELECT DISTINCT category FROM profit.records WHERE btrim(category)<>'' ORDER BY category");return {categories:rows.map(row=>row.category)}});
app.get(prefix+'/records/export',async(request,reply)=>{const q=searchSchema.parse(request.query);const {rows}=await pool.query('SELECT * FROM profit.records WHERE '+recordWhere+' ORDER BY updated_at DESC,id DESC',searchValues(q));const workbook=await exportHistoryWorkbook(rows);return reply.header('content-type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').header('content-disposition',"attachment; filename=profit-history.xlsx; filename*=UTF-8''%E5%8E%86%E5%8F%B2%E6%B5%8B%E7%AE%97.xlsx").send(workbook)});
app.get(prefix+'/records/:id',async(request,reply)=>{const id=z.uuid().parse((request.params as {id:string}).id);const {rows}=await pool.query('SELECT * FROM profit.records WHERE id=$1',[id]);if(!rows.length)return reply.code(404).send({error:'记录不存在'});return record(rows[0])});
app.get(prefix+'/stats',async(request)=>{const q=searchSchema.parse(request.query),values=searchValues(q);const columns="count(*)::int AS count,COALESCE(sum(net_rmb),0) AS total_rmb,COALESCE(avg(net_rmb),0) AS average_rmb,COALESCE(sum(net_usd),0) AS total_usd,COALESCE(avg(net_usd),0) AS average_usd";const [overall,byCategory,byMonth]=await Promise.all([pool.query('SELECT '+columns+' FROM profit.records WHERE '+recordWhere,values),pool.query('SELECT category,'+columns+' FROM profit.records WHERE '+recordWhere+' GROUP BY category ORDER BY category',values),pool.query("SELECT to_char(date_trunc('month',updated_at AT TIME ZONE 'Asia/Shanghai'),'YYYY-MM') AS month,"+columns+' FROM profit.records WHERE '+recordWhere+" GROUP BY date_trunc('month',updated_at AT TIME ZONE 'Asia/Shanghai') ORDER BY month DESC",values)]);const map=(row:Record<string,unknown>)=>({count:Number(row.count),totalRmb:Number(row.total_rmb),averageRmb:Number(row.average_rmb),totalUsd:Number(row.total_usd),averageUsd:Number(row.average_usd)});return {...map(overall.rows[0]),categories:byCategory.rows.map(row=>({category:row.category,...map(row)})),months:byMonth.rows.map(row=>({month:row.month,...map(row)}))}});

async function persistMeasurement(id:string|null,body:z.infer<typeof measurementSchema>,ownerKey:string){
 const client=await pool.connect();
 try{await client.query('BEGIN');const row=await saveMeasurement(client,id,body);const defaults=body.defaultFields===undefined?await initializeUserSettings(client,ownerKey):await saveUserSettings(client,ownerKey,body.defaultFields);await client.query('COMMIT');return {...record(row),defaults}}
 catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}
app.post(prefix+'/records',async(request,reply)=>reply.code(201).send(await persistMeasurement(null,measurementSchema.parse(request.body),await userSettings.owner(request,reply))));
app.patch(prefix+'/records/:id',async(request,reply)=>persistMeasurement(z.uuid().parse((request.params as {id:string}).id),measurementSchema.parse(request.body),await userSettings.owner(request,reply)));
app.put(prefix+'/products/:id/measurement',async(request,reply)=>{
 const id=z.uuid().parse((request.params as {id:string}).id),body=measurementSchema.parse(request.body),client=await pool.connect();
 try{
  const ownerKey=await userSettings.owner(request,reply);
  await client.query('BEGIN');const row=await saveCatalogMeasurement(client,id,body);const defaults=body.defaultFields===undefined?await initializeUserSettings(client,ownerKey):await saveUserSettings(client,ownerKey,body.defaultFields);await client.query('COMMIT');
  return {...product(row),saveTarget:'product',productId:row.id,defaults};
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
});
app.post(prefix+'/records/:id/restore',async(request,reply)=>{
 const id=z.uuid().parse((request.params as {id:string}).id),client=await pool.connect();
 try{
  await client.query('BEGIN');const {rows}=await client.query('SELECT * FROM profit.records WHERE id=$1 FOR UPDATE',[id]);
  if(!rows.length){await client.query('ROLLBACK');return reply.code(404).send({error:'记录不存在'})}
  const current=rows[0];if(!current.previous_snapshot){await client.query('ROLLBACK');return reply.code(409).send({error:'没有可恢复的上一版'})}
  const checked=checkedSnapshot(snapshotSchema.parse(current.previous_snapshot));
  const previousIdentity=current.previous_snapshot.identity||{name:current.name,specCode:current.spec_code,productCode:current.product_code,market:current.market};
  const identity={...previousIdentity,category:checked.snapshot.fields.attribute};
  const snapshot={...checked.snapshot,identity},result=checked.result;
  const productId=await syncMeasuredProduct(client,{...identity,snapshot,productId:current.product_id});
  const updated=await client.query('UPDATE profit.records SET name=$8,spec_code=$9,product_code=$10,product_id=$11,category=$6,previous_snapshot=snapshot,previous_saved_at=updated_at,previous_version=version,snapshot=$2::jsonb,net_rmb=$3,net_usd=$4,margin=$5,version=$7,updated_at=now() WHERE id=$1 RETURNING *',[id,JSON.stringify(snapshot),result?.netRmb??null,result?.netUsd??null,result?.margin??null,identity.category,current.previous_version??Math.max(1,current.version-1),identity.name,identity.specCode,identity.productCode,productId]);
  await client.query('COMMIT');return record(updated.rows[0]);
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
});
app.delete(prefix+'/records/:id',async(request)=>{const id=z.uuid().parse((request.params as {id:string}).id);const {rowCount}=await pool.query('DELETE FROM profit.records WHERE id=$1',[id]);return {deleted:!!rowCount}});

const port=Number(process.env.API_PORT||3002);await app.listen({host:'127.0.0.1',port});
async function shutdown(){await app.close();await pool.end()}
process.on('SIGINT',()=>{void shutdown()});process.on('SIGTERM',()=>{void shutdown()});
