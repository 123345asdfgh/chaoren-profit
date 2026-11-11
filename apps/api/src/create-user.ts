import {pool} from './db.js';
import {hashPassword,INITIAL_PASSWORD,ownerForUser,phoneSchema} from './auth.js';
import {readUserSettings} from './user-settings.js';
import {createInterface} from 'node:readline/promises';
const rl=createInterface({input:process.stdin,output:process.stdout});
try{
 const phone=phoneSchema.parse(await rl.question('手机号: ')),displayName=(await rl.question('姓名: ')).trim();
 if(!displayName||displayName.length>80)throw Error('请填写 1–80 字的姓名');
 const client=await pool.connect();try{
  await client.query('BEGIN');
  const {rows}=await client.query("INSERT INTO profit.users(phone,display_name,password_hash,role,must_change_password) VALUES($1,$2,$3,'user',true) RETURNING id",[phone,displayName,await hashPassword(INITIAL_PASSWORD)]);
  await readUserSettings(client,ownerForUser(rows[0].id));await client.query('COMMIT');console.log('用户已创建，初始密码为 88888888aA，首次登录必须修改。');
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}finally{rl.close();await pool.end()}
