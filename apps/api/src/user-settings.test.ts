import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import {describe,expect,it} from 'vitest';
import {defaultFieldsSchema,settingsIdentity} from './user-settings.js';

describe('personal default configuration',()=>{
 it('validates partial business settings without accepting identities or freight rules',()=>{
  expect(defaultFieldsSchema.parse({promotion:'0',fx:'7.2',zone:'America/New_York'})).toEqual({promotion:'0',fx:'7.2',zone:'America/New_York'});
  expect(defaultFieldsSchema.parse({})).toEqual({});
  for(const fields of [{promotion:''},{promotion:'101'},{fx:'0'},{divisor:'0'},{multiplier:'1001'},{tax:'NaN'},{zone:'America/Phoenix'},{userId:'other-user'},{freight:'anything'}])expect(defaultFieldsSchema.safeParse(fields).success).toBe(false);
 });

 it('isolates standalone visitors, persists their scope across requests, and ignores supplied user IDs',async()=>{
  const app=Fastify();await app.register(cookie);const owner=settingsIdentity();
  app.get('/scope',async(request,reply)=>({owner:await owner(request,reply),again:await owner(request,reply)}));
  try{
   const first=await app.inject('/scope'),second=await app.inject('/scope');
   expect(first.json().owner).not.toBe(second.json().owner);expect(first.json().owner).toBe(first.json().again);
   const savedCookie=String(first.headers['set-cookie']).split(';')[0];
   expect(savedCookie).toMatch(/^profit_visitor=/);expect(first.headers['set-cookie']).toContain('HttpOnly');
   const reload=await app.inject({url:'/scope?userId=someone-else',headers:{cookie:savedCookie,'x-user-id':'someone-else'}});
   expect(reload.json().owner).toBe(first.json().owner);expect(reload.headers['set-cookie']).toBeUndefined();
   expect(first.json().owner).not.toContain(savedCookie.split('=')[1]);
  }finally{await app.close()}
 });

 it('uses host authenticated identities across devices and separates different users',async()=>{
  const app=Fastify();await app.register(cookie);let authenticatedId:string|null='user-a';
  const owner=settingsIdentity({resolveUserId:()=>authenticatedId,standalone:false});
  app.get('/scope',async(request,reply)=>({owner:await owner(request,reply)}));
  try{
   const first=await app.inject('/scope'),sameUser=await app.inject('/scope');
   expect(first.json().owner).toBe(sameUser.json().owner);expect(first.json().owner).toMatch(/^user:/);expect(first.headers['set-cookie']).toBeUndefined();
   authenticatedId='user-b';expect((await app.inject('/scope')).json().owner).not.toBe(first.json().owner);
   authenticatedId=null;expect((await app.inject('/scope')).statusCode).toBe(401);
  }finally{await app.close()}
 });
});
