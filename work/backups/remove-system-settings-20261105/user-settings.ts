import {createHash,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import type {FastifyInstance,FastifyReply,FastifyRequest} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';

export const settingKeys=['fx','multiplier','costRate','divisor','tax','promotion','operation','platform','royalty','labor','other'] as const;
const zones=['America/Los_Angeles','America/Denver','America/Chicago','America/New_York'];
const require=createRequire(import.meta.url);
const initialFields={...Object.fromEntries(Object.entries(require('../../web/public/legacy/core.js').DEFAULTS).map(([key,value])=>[key,String(value)])),zone:zones[0]};
const initialFreight=require('../../web/public/legacy/freight-core.js').DEFAULT_CONFIG;
const allowedKeys=new Set<string>([...settingKeys,'zone']);
export const defaultFieldsSchema=z.record(z.string(),z.string().max(100)).superRefine((fields,context)=>{
 for(const [key,text]of Object.entries(fields)){
  const value=Number(text),min=key==='fx'?.000001:key==='divisor'?1:0,max=key==='fx'||key==='divisor'?1e9:key==='multiplier'?1000:100;
  if(!allowedKeys.has(key)||(key==='zone'?!zones.includes(text):text.trim()===''||!Number.isFinite(value)||value<min||value>max))context.addIssue({code:'custom',path:[key],message:'默认配置参数无效：'+key});
 }
});
type Database=Pick<PoolClient,'query'>;

// The shared configuration is a read-only initial template. Personal rows contain
// business fields only; hidden freight rules never become personal overrides.
export async function readUserSettings(db:Database,ownerKey:string){
 const [initial,personal]=await Promise.all([
  db.query('SELECT fields FROM profit.global_settings WHERE id=1'),
  db.query('SELECT fields,updated_at FROM profit.calculation_defaults WHERE owner_key=$1',[ownerKey])
 ]);
 const template=initial.rows[0]?.fields;
 return {fields:{...initialFields,...template?.fields,...personal.rows[0]?.fields},freight:template?.freight||structuredClone(initialFreight),hasPersonalDefaults:personal.rows.length>0,updatedAt:personal.rows[0]?.updated_at??null};
}

export async function saveUserSettings(db:Database,ownerKey:string,changes:Record<string,string>){
 const patch=defaultFieldsSchema.parse(changes),current=await readUserSettings(db,ownerKey);
 const fields=Object.fromEntries([...settingKeys,'zone'].map(key=>[key,current.fields[key]]));
 const {rows}=await db.query(`INSERT INTO profit.calculation_defaults(owner_key,fields) VALUES($1,$2::jsonb)
  ON CONFLICT(owner_key) DO UPDATE SET fields=profit.calculation_defaults.fields||$3::jsonb,updated_at=now()
  RETURNING fields,updated_at`,[ownerKey,JSON.stringify({...fields,...patch}),JSON.stringify(patch)]);
 return {fields:rows[0].fields,hasPersonalDefaults:true,updatedAt:rows[0].updated_at};
}

export async function initializeUserSettings(db:Database,ownerKey:string){
 const current=await readUserSettings(db,ownerKey);if(current.hasPersonalDefaults)return;
 const fields=Object.fromEntries([...settingKeys,'zone'].map(key=>[key,current.fields[key]]));
 await db.query('INSERT INTO profit.calculation_defaults(owner_key,fields) VALUES($1,$2::jsonb) ON CONFLICT(owner_key) DO NOTHING',[ownerKey,JSON.stringify(fields)]);
}

export type UserIdResolver=(request:FastifyRequest)=>string|null|Promise<string|null>;
export function settingsIdentity(options:{resolveUserId?:UserIdResolver;standalone?:boolean}={}){
 const cache=new WeakMap<FastifyRequest,string>();
 return async(request:FastifyRequest,reply:FastifyReply)=>{
  const cached=cache.get(request);if(cached)return cached;
  // On integration this resolver receives the authenticated identity from the
  // host application. User IDs from request headers or bodies are never trusted.
  const userId=await options.resolveUserId?.(request);
  let ownerKey:string;
  if(userId){ownerKey='user:'+createHash('sha256').update(userId).digest('hex')}
  else{
   if(options.standalone===false)throw Object.assign(Error('缺少主项目用户身份'),{statusCode:401});
   let token=request.cookies.profit_visitor;
   if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token)){
    token=randomBytes(32).toString('base64url');
    reply.setCookie('profit_visitor',token,{path:'/api/profit',httpOnly:true,sameSite:'lax',secure:request.protocol==='https',maxAge:60*60*24*365});
   }
   ownerKey='standalone:'+createHash('sha256').update(token).digest('hex');
  }
  cache.set(request,ownerKey);return ownerKey;
 };
}

export function registerUserSettingsRoutes(app:FastifyInstance,prefix:string,db:Pool,options:{resolveUserId?:UserIdResolver;standalone?:boolean}={}){
 const owner=settingsIdentity(options);
 app.get(prefix+'/settings',async(request,reply)=>readUserSettings(db,await owner(request,reply)));
 app.put(prefix+'/settings',async(request,reply)=>{
  const {fields}=z.strictObject({fields:defaultFieldsSchema}).parse(request.body);
  return saveUserSettings(db,await owner(request,reply),fields);
 });
 return {owner};
}
