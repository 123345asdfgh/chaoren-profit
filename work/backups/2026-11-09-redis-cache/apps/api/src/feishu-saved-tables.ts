import type {FastifyInstance,FastifyReply,FastifyRequest} from 'fastify';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {FeishuService,tableLink,type ReadOptions} from './feishu.js';

type Database=Pick<PoolClient,'query'>;
type Owner=(request:FastifyRequest,reply:FastifyReply)=>Promise<string>;
export const PRIMARY_SOURCE={url:'https://zcn9jcxsw49y.feishu.cn/base/Cvi3bwQCEaidVpsES6FcA8z7nVh',key:'base:Cvi3bwQCEaidVpsES6FcA8z7nVh',tableId:'tblHWhOsyNN1pYlH',name:'寄样统计表（天）'};
const saveSchema=z.strictObject({url:z.string().trim().min(1).max(2000),tableId:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/),sourceType:z.literal('secondary').optional()});
const missing=()=>Object.assign(new Error('已保存的表格不存在，请刷新列表。'),{statusCode:404});
function saved(row:Record<string,any>){return {id:row.id,name:row.name,documentName:row.document_name||'',sourceType:row.source_type,url:row.url,tableId:row.table_id,updatedAt:row.updated_at}}

export class SavedFeishuTables{
 constructor(private db:Database,private service:Pick<FeishuService,'tables'|'read'>){}
 async ensurePrimary(owner:string){
  const {rows}=await this.db.query(`INSERT INTO profit.feishu_saved_tables(owner_key,source_key,url,table_id,name,source_type)
   VALUES($1,$2,$3,$4,$5,'primary') ON CONFLICT(owner_key,source_key,table_id)
   DO UPDATE SET source_type='primary' RETURNING *`,[owner,PRIMARY_SOURCE.key,PRIMARY_SOURCE.url,PRIMARY_SOURCE.tableId,PRIMARY_SOURCE.name]);
  return saved(rows[0]);
 }
 async list(owner:string){
  await this.ensurePrimary(owner);
  const {rows}=await this.db.query("SELECT * FROM profit.feishu_saved_tables WHERE owner_key=$1 ORDER BY source_type ASC,updated_at DESC,id DESC",[owner]);
  return {tables:rows.map(saved)};
 }
 async save(owner:string,input:unknown){
  const body=saveSchema.parse(input),source=tableLink(body.url);
  const available=await this.service.tables(owner,body.url),table=available.tables.find(item=>item.id===body.tableId);
  if(!table)throw Object.assign(new Error('所选数据表不在此链接中，请重新获取数据表。'),{statusCode:400});
  const url=new URL(source.url);url.search='';url.hash='';
  const key=source.kind+':'+source.token,sourceType=key===PRIMARY_SOURCE.key&&table.id===PRIMARY_SOURCE.tableId?'primary':'secondary';
  const {rows}=await this.db.query(`INSERT INTO profit.feishu_saved_tables(owner_key,source_key,url,table_id,name,source_type,document_name)
   VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(owner_key,source_key,table_id)
   DO UPDATE SET url=EXCLUDED.url,name=EXCLUDED.name,source_type=EXCLUDED.source_type,document_name=EXCLUDED.document_name,updated_at=now()
   RETURNING *`,[owner,key,url.href,table.id,table.name.slice(0,500),sourceType,(available.documentName||'').slice(0,500)]);
  return saved(rows[0]);
 }
 async read(owner:string,id:string,options:ReadOptions={}){
  const {rows}=await this.db.query('SELECT * FROM profit.feishu_saved_tables WHERE owner_key=$1 AND id=$2',[owner,z.uuid().parse(id)]);
  if(!rows.length)throw missing();
  const row=rows[0],data=await this.service.read(owner,row.url,row.table_id,options);
  const name=data.name===row.table_id?row.name:data.name,documentName=data.documentName||row.document_name||'';
  await this.db.query('UPDATE profit.feishu_saved_tables SET name=$3,document_name=$4 WHERE owner_key=$1 AND id=$2',[owner,id,name.slice(0,500),documentName.slice(0,500)]);
  return {...data,name,documentName};
 }

}

export function registerSavedFeishuTableRoutes(app:FastifyInstance,prefix:string,owner:Owner,store:SavedFeishuTables){
 const route=prefix+'/feishu/saved-tables';
 app.get(route,async(request,reply)=>store.list(await owner(request,reply)));
 app.post(route,async(request,reply)=>store.save(await owner(request,reply),request.body));
 app.post(route+'/:id/read',async(request,reply)=>store.read(await owner(request,reply),(request.params as {id:string}).id));
}
