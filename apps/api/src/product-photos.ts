import {createHash} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {pool} from './db.js';

export const maxPhotoBytes=5*1024*1024;
export function photoType(data:Buffer){
 if(!data.length||data.length>maxPhotoBytes)throw Object.assign(Error('照片大小不能超过 5 MB。'),{statusCode:400});
 if(data.length>=24&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&data.toString('ascii',12,16)==='IHDR')return 'image/png';
 if(data.length>=12&&data[0]===255&&data[1]===216&&data[2]===255&&data[data.length-2]===255&&data[data.length-1]===217)return 'image/jpeg';
 if(data.length>=20&&data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(data.toString('ascii',12,16)))return 'image/webp';
 throw Object.assign(Error('请选择 JPG、PNG 或 WebP 格式的照片。'),{statusCode:400});
}
export function registerPhotoRoutes(app:FastifyInstance,prefix:string){
 app.addContentTypeParser('application/octet-stream',{parseAs:'buffer',bodyLimit:maxPhotoBytes},(_request,body,done)=>done(null,body));
 app.post(prefix+'/product-photos',{bodyLimit:maxPhotoBytes},async(request,reply)=>{
  if(!Buffer.isBuffer(request.body))return reply.code(400).send({error:'请上传照片文件。'});
  const data=request.body,type=photoType(data),hash=createHash('sha256').update(data).digest('hex');
  const {rows}=await pool.query('INSERT INTO profit.product_photos(content_hash,mime_type,data) VALUES($1,$2,$3) ON CONFLICT(content_hash) DO UPDATE SET content_hash=EXCLUDED.content_hash RETURNING id',[hash,type,data]);
  return reply.code(201).send({id:rows[0].id});
 });
 app.get(prefix+'/product-photos/:id',async(request,reply)=>{
  const id=z.uuid().parse((request.params as {id:string}).id);
  const {rows}=await pool.query('SELECT mime_type,data FROM profit.product_photos WHERE id=$1',[id]);
  if(!rows.length)return reply.code(404).send({error:'照片不存在。'});
  return reply.header('Content-Type',rows[0].mime_type).header('X-Content-Type-Options','nosniff').header('Cache-Control','public, max-age=31536000, immutable').send(rows[0].data);
 });
}
