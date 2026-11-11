import {createHash,randomBytes} from 'node:crypto';
import {hash,verify,Algorithm} from '@node-rs/argon2';
import type {FastifyInstance,FastifyReply,FastifyRequest} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {readUserSettings} from './user-settings.js';

export const INITIAL_PASSWORD='88888888aA';
export const SESSION_COOKIE='profit_session';
const SESSION_SECONDS=12*60*60;
const passwordOptions={algorithm:Algorithm.Argon2id,memoryCost:19456,timeCost:2,parallelism:1};
export const hashPassword=(value:string)=>hash(value,passwordOptions);
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const fail=(message:string,statusCode=400)=>Object.assign(Error(message),{statusCode});
export type AuthUser={id:string;account:string;displayName:string;role:'admin'|'user';mustChangePassword:boolean};
declare module 'fastify' {interface FastifyRequest {authUser:AuthUser|null;authTokenHash:string|null}}
const publicUser=(row:Record<string,unknown>):AuthUser=>({id:String(row.id),account:String(row.account),displayName:String(row.display_name),role:row.role as AuthUser['role'],mustChangePassword:row.must_change_password===true});
export const ownerForUser=(id:string)=>'user:'+digest(id);
const accountSchema=z.string().trim().normalize().min(1).max(64).regex(/^[\p{L}\p{N}_.@-]+$/u,'账号仅支持中文、字母、数字、点、下划线、@ 和短横线');
export const newPasswordSchema=z.string().min(10,'新密码至少需要 10 位').max(128,'新密码最多 128 位').refine(value=>/[a-z]/.test(value)&&/[A-Z]/.test(value)&&/[0-9]/.test(value),'密码须包含大写字母、小写字母和数字').refine(value=>value!==INITIAL_PASSWORD,'新密码不能使用初始密码');
const loginSchema=z.strictObject({account:accountSchema,password:z.string().min(1).max(128)});
const userSchema=z.strictObject({account:accountSchema,displayName:z.string().trim().min(1).max(80)});
const tokenOf=(request:FastifyRequest)=>{const value=request.cookies[SESSION_COOKIE];return value&&/^[A-Za-z0-9_-]{43}$/.test(value)?digest(value):null};
const cookieOptions=(request:FastifyRequest)=>({path:'/',httpOnly:true,sameSite:'lax' as const,secure:request.protocol==='https'||process.env.SESSION_COOKIE_SECURE==='true'});
async function issueSession(db:Pick<PoolClient,'query'>,request:FastifyRequest,reply:FastifyReply,userId:string){
 const token=randomBytes(32).toString('base64url');
 await db.query("INSERT INTO profit.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",[digest(token),userId]);
 reply.setCookie(SESSION_COOKIE,token,{...cookieOptions(request),maxAge:SESSION_SECONDS});
}
export async function seedInitialUsers(db:Pool){
 const client=await db.connect();
 try{
  await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtext('profit-initial-users'))");
  for(const [account,role]of [['小红','admin'],['小蓝','user'],['小白','user']]){
   const inserted=await client.query('INSERT INTO profit.users(account,display_name,password_hash,role,must_change_password) VALUES($1,$1,$2,$3,true) ON CONFLICT DO NOTHING RETURNING id',[account,await hashPassword(INITIAL_PASSWORD),role]);
   if(inserted.rows.length)await readUserSettings(client,ownerForUser(inserted.rows[0].id));
  }
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}
export function requireUser(request:FastifyRequest){if(!request.authUser)throw fail('请先登录',401);return request.authUser}

export async function registerAuth(app:FastifyInstance,prefix:string,db:Pool){
 app.decorateRequest('authUser',null);app.decorateRequest('authTokenHash',null);
 const dummyHash=await hashPassword(randomBytes(32).toString('base64url'));
 const ipFailures=new Map<string,{count:number;until:number}>();
 const publicPaths=new Set([prefix+'/health',prefix+'/auth/login']);
 const forcedPaths=new Set([prefix+'/auth/session',prefix+'/auth/password',prefix+'/auth/logout']);
 app.addHook('onRequest',async(request,reply)=>{
  const pathname=request.url.split('?')[0];if(!pathname.startsWith(prefix+'/'))return;
  reply.header('cache-control','no-store');
  if(publicPaths.has(pathname))return;
  const tokenHash=tokenOf(request);
  if(tokenHash){
   const {rows}=await db.query('SELECT u.* FROM profit.sessions s JOIN profit.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND NOT u.disabled',[tokenHash]);
   if(rows.length){request.authUser=publicUser(rows[0]);request.authTokenHash=tokenHash;}
  }
  if(!request.authUser){reply.clearCookie(SESSION_COOKIE,cookieOptions(request));return reply.code(401).send({error:'登录已失效，请重新登录',code:'UNAUTHENTICATED'})}
  if(request.authUser.mustChangePassword&&!forcedPaths.has(pathname))return reply.code(403).send({error:'首次登录或密码已重置，请先修改密码',code:'PASSWORD_CHANGE_REQUIRED'});
  if(pathname.startsWith(prefix+'/admin/')&&request.authUser.role!=='admin')return reply.code(403).send({error:'此操作仅管理员可用',code:'FORBIDDEN'});
 });
 app.post(prefix+'/auth/login',async(request,reply)=>{
  const ip=request.ip,now=Date.now(),throttle=ipFailures.get(ip);
  if(throttle&&throttle.until>now&&throttle.count>=30)return reply.code(429).send({error:'登录尝试过多，请 15 分钟后重试'});
  if(throttle&&throttle.until<=now)ipFailures.delete(ip);
  const parsed=loginSchema.safeParse(request.body);
  if(!parsed.success)throw fail('请输入有效的账号和密码');
  const {account,password}=parsed.data;
  const found=await db.query('SELECT * FROM profit.users WHERE lower(account)=lower($1)',[account]),user=found.rows[0];
  const matches=await verify(user?.password_hash||dummyHash,password);
  if(!user||!matches||user.disabled||user.locked_until&&new Date(user.locked_until).getTime()>now){
   if(ipFailures.size>10000)for(const [key,value]of ipFailures)if(value.until<=now)ipFailures.delete(key);
   ipFailures.set(ip,{count:(ipFailures.get(ip)?.count||0)+1,until:throttle?.until&&throttle.until>now?throttle.until:now+15*60*1000});
   if(user&&!user.disabled)await db.query("UPDATE profit.users SET failed_login_attempts=failed_login_attempts+1,locked_until=CASE WHEN failed_login_attempts+1>=10 THEN now()+interval '15 minutes' ELSE locked_until END WHERE id=$1",[user.id]);
   throw fail('账号或密码错误，或账号暂时不可用',401);
  }
  const client=await db.connect();
  try{
   await client.query('BEGIN');
   const current=(await client.query('SELECT * FROM profit.users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];
   if(!current||current.disabled||current.password_hash!==user.password_hash)throw fail('账号状态已变化，请重新登录',401);
   if(current.locked_until&&new Date(current.locked_until).getTime()>Date.now())throw fail('账号暂时不可用，请稍后重试',401);
   const previous=tokenOf(request);if(previous)await client.query('DELETE FROM profit.sessions WHERE token_hash=$1',[previous]);
   await client.query('DELETE FROM profit.sessions WHERE expires_at<=now()');
   await client.query('UPDATE profit.users SET failed_login_attempts=0,locked_until=NULL,last_login_at=now() WHERE id=$1',[user.id]);
   await readUserSettings(client,ownerForUser(user.id));
   await issueSession(client,request,reply,user.id);
   await client.query("INSERT INTO profit.auth_events(actor_id,target_id,action) VALUES($1,$1,'login')",[user.id]);
   await client.query('COMMIT');ipFailures.delete(ip);return {user:publicUser(current)};
  }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
 });
 app.get(prefix+'/auth/session',async request=>({user:requireUser(request)}));
 app.post(prefix+'/auth/logout',async(request,reply)=>{
  await db.query('DELETE FROM profit.sessions WHERE token_hash=$1',[request.authTokenHash]);
  await db.query("INSERT INTO profit.auth_events(actor_id,target_id,action) VALUES($1,$1,'logout')",[requireUser(request).id]);
  reply.clearCookie(SESSION_COOKIE,cookieOptions(request));return {ok:true};
 });
 app.put(prefix+'/auth/password',async(request,reply)=>{
  const parsed=z.strictObject({currentPassword:z.string().min(1).max(128),newPassword:newPasswordSchema}).safeParse(request.body);
  if(!parsed.success)throw fail(parsed.error.issues[0]?.message||'密码格式无效');
  const input=parsed.data,user=requireUser(request),client=await db.connect();
  try{
   await client.query('BEGIN');const row=(await client.query('SELECT * FROM profit.users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];
   // Recheck the session under the user lock so concurrent resets/changes cannot reuse a revoked session.
   const live=await client.query('SELECT token_hash FROM profit.sessions WHERE token_hash=$1 AND expires_at>now()',[request.authTokenHash]);
   if(!row||row.disabled||!live.rows.length)throw fail('登录已失效，请重新登录',401);
   if(!await verify(row.password_hash,input.currentPassword))throw fail('当前密码不正确');
   if(await verify(row.password_hash,input.newPassword))throw fail('新密码不能与当前密码相同');
   await client.query('UPDATE profit.users SET password_hash=$2,must_change_password=false,password_changed_at=now(),failed_login_attempts=0,locked_until=NULL WHERE id=$1',[user.id,await hashPassword(input.newPassword)]);
   await client.query('DELETE FROM profit.sessions WHERE user_id=$1',[user.id]);
   await issueSession(client,request,reply,user.id);
   await client.query("INSERT INTO profit.auth_events(actor_id,target_id,action) VALUES($1,$1,'change_password')",[user.id]);
   await client.query('COMMIT');return {ok:true,user:{...user,mustChangePassword:false}};
  }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
 });
 app.get(prefix+'/admin/users',async()=>{
  const {rows}=await db.query('SELECT id,account,display_name,role,must_change_password,disabled,created_at,last_login_at,locked_until FROM profit.users ORDER BY created_at,id');
  return {users:rows.map(row=>({...publicUser(row),disabled:row.disabled,createdAt:row.created_at,lastLoginAt:row.last_login_at,lockedUntil:row.locked_until}))};
 });
 app.post(prefix+'/admin/users',async(request,reply)=>{
  const body=userSchema.parse(request.body),admin=requireUser(request),client=await db.connect();
  try{
   await client.query('BEGIN');
   const duplicate=await client.query('SELECT id FROM profit.users WHERE lower(account)=lower($1)',[body.account]);if(duplicate.rows.length)throw fail('该账号已存在',409);
   const row=(await client.query("INSERT INTO profit.users(account,display_name,password_hash,role,must_change_password,created_by) VALUES($1,$2,$3,'user',true,$4) RETURNING *",[body.account,body.displayName,await hashPassword(INITIAL_PASSWORD),admin.id])).rows[0];
   await readUserSettings(client,ownerForUser(row.id));
   await client.query("INSERT INTO profit.auth_events(actor_id,target_id,action) VALUES($1,$2,'create_user')",[admin.id,row.id]);
   await client.query('COMMIT');return reply.code(201).send({user:publicUser(row)});
  }catch(error){await client.query('ROLLBACK');if((error as {code?:string}).code==='23505')throw fail('该账号已存在',409);throw error}finally{client.release()}
 });
 app.post(prefix+'/admin/users/:id/reset-password',async(request)=>{
  const id=z.uuid().parse((request.params as {id:string}).id),admin=requireUser(request);if(id===admin.id)throw fail('请在“修改密码”中修改自己的密码');
  const client=await db.connect();try{
   await client.query('BEGIN');const row=(await client.query('SELECT id FROM profit.users WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw fail('用户不存在',404);
   await client.query('UPDATE profit.users SET password_hash=$2,must_change_password=true,failed_login_attempts=0,locked_until=NULL WHERE id=$1',[id,await hashPassword(INITIAL_PASSWORD)]);
   await client.query('DELETE FROM profit.sessions WHERE user_id=$1',[id]);
   await client.query("INSERT INTO profit.auth_events(actor_id,target_id,action) VALUES($1,$2,'reset_password')",[admin.id,id]);
   await client.query('COMMIT');return {ok:true};
  }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
 });
 app.patch(prefix+'/admin/users/:id',async(request)=>{
  const id=z.uuid().parse((request.params as {id:string}).id),{disabled}=z.strictObject({disabled:z.boolean()}).parse(request.body),admin=requireUser(request);
  if(id===admin.id)throw fail('不能停用自己的账号');
  const client=await db.connect();try{
   await client.query('BEGIN');const row=(await client.query('SELECT * FROM profit.users WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw fail('用户不存在',404);
   if(row.role==='admin')throw fail('管理员账号不可在此停用');
   await client.query('UPDATE profit.users SET disabled=$2,failed_login_attempts=0,locked_until=NULL WHERE id=$1',[id,disabled]);
   await client.query('DELETE FROM profit.sessions WHERE user_id=$1',[id]);
   await client.query('INSERT INTO profit.auth_events(actor_id,target_id,action) VALUES($1,$2,$3)',[admin.id,id,disabled?'disable_user':'enable_user']);
   await client.query('COMMIT');return {ok:true};
  }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
 });
}
