import {describe,expect,it,vi} from 'vitest';
import Fastify from 'fastify';
import ExcelJS from 'exceljs';
import type {Pool} from 'pg';
import {record,registerRecordVersionRoutes,versionGaps} from './record-versions.js';

const id='3610a93e-d98e-4bec-8632-08a2ce273fab';
const stored=(version:number)=>({id,product_id:'fe5c2c3d-1396-413f-beb6-23fb94307694',name:'商品',spec_code:'A',product_code:'P',version,snapshot:{fields:{promotion:String(version*10),fx:'6.8'},result:{netRmb:version,margin:.1}},net_rmb:version,net_usd:version/6.8,margin:.1,updated_at:'2026-11-09T04:00:00Z'});
const archive=(version:number)=>({record_id:id,version,data:stored(version),saved_at:'2026-11-09T04:00:00Z'});

describe('per-order version history',()=>{
 it('exports only the selected order, with each original saved version and no freight configuration tab',async()=>{
  const query=vi.fn().mockResolvedValueOnce({rows:[stored(3)]}).mockResolvedValueOnce({rows:[archive(1),archive(2),archive(3)]});
  const app=Fastify();registerRecordVersionRoutes(app,'/api/profit',{query} as unknown as Pool);
  try{
   const response=await app.inject('/api/profit/records/'+id+'/export');
   expect(response.statusCode).toBe(200);
   expect(response.headers['content-type']).toContain('spreadsheetml.sheet');
   const book=new ExcelJS.Workbook();await book.xlsx.load(Uint8Array.from(response.rawPayload).buffer);
   expect(book.worksheets.map(sheet=>sheet.name)).toEqual(['历史测算']);
   const sheet=book.worksheets[0],headers=sheet.getRow(2).values as string[];
   expect([3,4,5].map(row=>sheet.getCell(row,headers.indexOf('当前版本')).value)).toEqual([1,2,3]);
   expect([3,4,5].map(row=>sheet.getCell(row,headers.indexOf('推广费率（%）')).value)).toEqual([10,20,30]);
   expect([3,4,5].map(row=>sheet.getCell(row,headers.indexOf('净利润（RMB）')).value)).toEqual([1,2,3]);
   expect(query.mock.calls[1][1]).toEqual([id]);
   expect(query.mock.calls.every(([sql])=>sql.startsWith('SELECT'))).toBe(true);
  }finally{await app.close()}
 });
 it('exports a requested old version without substituting the current version',async()=>{
  const query=vi.fn().mockResolvedValueOnce({rows:[stored(3)]}).mockResolvedValueOnce({rows:[archive(1)]});
  const app=Fastify();registerRecordVersionRoutes(app,'/api/profit',{query} as unknown as Pool);
  try{
   const response=await app.inject('/api/profit/records/'+id+'/export?version=1');
   expect(response.statusCode).toBe(200);
   const book=new ExcelJS.Workbook();await book.xlsx.load(Uint8Array.from(response.rawPayload).buffer);
   const sheet=book.worksheets[0],headers=sheet.getRow(2).values as string[];
   expect(sheet.rowCount).toBe(3);expect(sheet.getCell(3,headers.indexOf('当前版本')).value).toBe(1);
   expect(query.mock.calls[1][1]).toEqual([id,1]);
  }finally{await app.close()}
 });
 it('returns a missing-version error instead of exporting another version',async()=>{
  const query=vi.fn().mockResolvedValueOnce({rows:[stored(3)]}).mockResolvedValueOnce({rows:[]});
  const app=Fastify();registerRecordVersionRoutes(app,'/api/profit',{query} as unknown as Pool);
  try{expect((await app.inject('/api/profit/records/'+id+'/export?version=2')).statusCode).toBe(404)}finally{await app.close()}
 });
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
