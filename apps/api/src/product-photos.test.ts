import {afterEach,describe,expect,it,vi} from 'vitest';
import Fastify from 'fastify';
const {query}=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('./db.js',()=>({pool:{query}}));
import {registerPhotoRoutes,maxPhotoBytes} from './product-photos.js';
import {checkedSnapshot} from './snapshot.js';
const id='81e7cc54-0468-4ff2-b3b3-7aebcd2e9f3c';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH1sAAAAASUVORK5CYII=','base64');
afterEach(()=>vi.resetAllMocks());
async function server(){const app=Fastify();registerPhotoRoutes(app,'/api/profit');return app}
describe('product photo persistence',()=>{
 it('stores image bytes and serves them with a safe content type',async()=>{
  const app=await server();try{
   query.mockResolvedValueOnce({rows:[{id}]});
   const uploaded=await app.inject({method:'POST',url:'/api/profit/product-photos',headers:{'content-type':'application/octet-stream'},payload:png});
   expect(uploaded.statusCode).toBe(201);expect(uploaded.json()).toEqual({id});expect(query.mock.calls[0][1][2]).toEqual(png);
   query.mockResolvedValueOnce({rows:[{mime_type:'image/png',data:png}]});
   const image=await app.inject('/api/profit/product-photos/'+id);
   expect(image.statusCode).toBe(200);expect(image.rawPayload).toEqual(png);expect(image.headers['x-content-type-options']).toBe('nosniff');expect(image.headers['content-type']).toBe('image/png');
  }finally{await app.close()}
 });
 it('rejects fake images and oversized uploads before storing them',async()=>{
  const app=await server();try{
   for(const payload of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),Buffer.alloc(maxPhotoBytes+1)]){
    const response=await app.inject({method:'POST',url:'/api/profit/product-photos',headers:{'content-type':'application/octet-stream'},payload});
    expect(response.statusCode).toBe(payload.length>maxPhotoBytes?413:400);
   }
   expect(query).not.toHaveBeenCalled();
  }finally{await app.close()}
 });
 it('keeps optional photo IDs in saved snapshots and rejects arbitrary URLs',()=>{
  expect(checkedSnapshot({fields:{photoId:id}}).snapshot.fields.photoId).toBe(id);
  expect(checkedSnapshot({fields:{}}).snapshot.fields.photoId).toBeUndefined();
  expect(()=>checkedSnapshot({fields:{photoId:'https://example.com/a.png'}})).toThrow('商品照片无效');
 });
});
