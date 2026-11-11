import {afterEach,describe,expect,it,vi} from 'vitest';
import Fastify from 'fastify';
const {query}=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('./db.js',()=>({pool:{query}}));
import {product,registerProductRoutes} from './products.js';
afterEach(()=>vi.resetAllMocks());
describe('catalog saved profit display',()=>{
 it('returns the saved result and preserves editable product data',()=>{
  const row={id:'product',name:'A',spec_code:'A-01',product_code:'P-01',attribute:'普货',length:'20',width:'15',height:'10',weight:'0.2',snapshot:{fields:{promotion:'55'},result:{netRmb:-12.35,netUsd:-1.8,margin:-.125}}};
  expect(product(row)).toMatchObject({netRmb:-12.35,netUsd:-1.8,margin:-.125,length:20,width:15,height:10,weight:.2,snapshot:row.snapshot});
  expect(product({...row,snapshot:{result:{netRmb:0,netUsd:0,margin:0}}})).toMatchObject({netRmb:0,netUsd:0,margin:0});
 });
 it('leaves missing and incomplete results empty',()=>{
  for(const snapshot of [null,{fields:{}},{result:null}])expect(product({snapshot})).toMatchObject({netRmb:null,netUsd:null,margin:null});
 });
 it('includes saved profit in catalog responses without changing any records',async()=>{
  const app=Fastify();registerProductRoutes(app,'/api/profit');
  query.mockImplementation(async(sql:string)=>sql.includes('count(*)')?{rows:[{total:1}]}:{rows:[{id:'product',spec_code:'A',snapshot:{result:{netRmb:8.6,netUsd:1.26,margin:.0526}}}]});
  try{
   const response=await app.inject('/api/profit/products?specCode=A');
   expect(response.statusCode).toBe(200);expect(response.json().products[0]).toMatchObject({netRmb:8.6,margin:.0526});
   expect(query.mock.calls.every(([sql])=>sql.startsWith('SELECT'))).toBe(true);
  }finally{await app.close()}
 });
});

describe('catalog deletion',()=>{
 it('accepts a bodyless DELETE and only deletes the requested product',async()=>{
  const app=Fastify();registerProductRoutes(app,'/api/profit');
  const id='3349ab58-dba7-4b27-8a0c-a099a3440431';
  query.mockResolvedValueOnce({rows:[{id,name:'删除测试商品'}]});
  try{
   const response=await app.inject({method:'DELETE',url:'/api/profit/products/'+id});
   expect(response.statusCode).toBe(200);
   expect(response.json()).toEqual({deleted:true,id,name:'删除测试商品'});
   expect(query).toHaveBeenCalledExactlyOnceWith('DELETE FROM profit.products WHERE id=$1 RETURNING id,name',[id]);
  }finally{await app.close()}
 });
 it('returns a clear error when the product was already deleted',async()=>{
  const app=Fastify();registerProductRoutes(app,'/api/profit');
  query.mockResolvedValueOnce({rows:[]});
  try{
   const response=await app.inject({method:'DELETE',url:'/api/profit/products/3349ab58-dba7-4b27-8a0c-a099a3440431'});
   expect(response.statusCode).toBe(404);
   expect(response.json().error).toBe('商品资料不存在，请刷新列表。');
  }finally{await app.close()}
 });
});
