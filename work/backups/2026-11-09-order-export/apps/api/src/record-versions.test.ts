import {describe,expect,it,vi} from 'vitest';
import Fastify from 'fastify';
import type {Pool} from 'pg';
import {record,registerRecordVersionRoutes,versionGaps} from './record-versions.js';

const id='3610a93e-d98e-4bec-8632-08a2ce273fab';
const stored=(version:number)=>({id,product_id:'fe5c2c3d-1396-413f-beb6-23fb94307694',name:'商品',spec_code:'A',product_code:'P',version,snapshot:{fields:{promotion:String(version*10),fx:'6.8'},result:{netRmb:version,margin:.1}},net_rmb:version,net_usd:version/6.8,margin:.1,updated_at:'2026-11-09T04:00:00Z'});
const archive=(version:number)=>({record_id:id,version,data:stored(version),saved_at:'2026-11-09T04:00:00Z'});

describe('per-order version history',()=>{
 it('reports missing legacy versions without renumbering saved versions',()=>{
  expect(versionGaps([5,4])).toEqual(['1–3']);
  expect(versionGaps([1,2,3])).toEqual([]);
  expect(versionGaps([1,3,6,6])).toEqual(['2','4–5']);
  expect(record({version:1,snapshot:{fields:{}}}).netRmb).toBeNull();
 });
 it('reads every saved version of the selected order and marks the effective version',async()=>{
  const query=vi.fn().mockResolvedValueOnce({rows:[stored(2)]}).mockResolvedValueOnce({rows:[archive(1),archive(2),archive(3)]});
  const app=Fastify();registerRecordVersionRoutes(app,'/api/profit',{query} as unknown as Pool);
  try{
   const response=await app.inject('/api/profit/records/'+id+'/versions');
   expect(response.statusCode).toBe(200);
   expect(response.json().records.map((row:{version:number;isCurrent:boolean})=>[row.version,row.isCurrent])).toEqual([[1,false],[2,true],[3,false]]);
   expect(query.mock.calls[1][1]).toEqual([id]);
   expect(query.mock.calls.every(([sql])=>sql.startsWith('SELECT'))).toBe(true);
  }finally{await app.close()}
 });
 it('returns the requested historical snapshot with its original fees and result',async()=>{
  const query=vi.fn().mockResolvedValueOnce({rows:[{...archive(1),current_version:5}]});
  const app=Fastify();registerRecordVersionRoutes(app,'/api/profit',{query} as unknown as Pool);
  try{
   const response=await app.inject('/api/profit/records/'+id+'/versions/1');
   expect(response.statusCode).toBe(200);
   expect(response.json()).toMatchObject({id,version:1,isCurrent:false,netRmb:1,snapshot:{fields:{promotion:'10',fx:'6.8'},result:{netRmb:1}}});
   expect(query.mock.calls[0][1]).toEqual([id,1]);
  }finally{await app.close()}
 });
 it('does not substitute the current snapshot for a missing old version',async()=>{
  const query=vi.fn().mockResolvedValueOnce({rows:[]});
  const app=Fastify();registerRecordVersionRoutes(app,'/api/profit',{query} as unknown as Pool);
  try{expect((await app.inject('/api/profit/records/'+id+'/versions/2')).statusCode).toBe(404)}finally{await app.close()}
 });
 it('resolves an old product link to one current order without mixing different orders',async()=>{
  const query=vi.fn().mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[stored(5)]}).mockResolvedValueOnce({rows:[archive(4),archive(5)]});
  const app=Fastify();registerRecordVersionRoutes(app,'/api/profit',{query} as unknown as Pool);
  try{
   const response=await app.inject('/api/profit/records/fe5c2c3d-1396-413f-beb6-23fb94307694/versions');
   expect(response.json()).toMatchObject({record:{id,version:5},missingVersions:['1–3']});
   expect(query.mock.calls[2][1]).toEqual([id]);
  }finally{await app.close()}
 });
});
