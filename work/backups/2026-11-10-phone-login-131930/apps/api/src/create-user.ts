import {pool} from './db.js';
import {hashPassword,INITIAL_PASSWORD,ownerForUser} from './auth.js';
import {readUserSettings} from './user-settings.js';
import {createInterface} from 'node:readline/promises';
const rl=createInterface({input:process.stdin,output:process.stdout});
try{
 const account=(await rl.question('账号: ')).trim(),displayName=(await rl.question('姓名: ')).trim()||account;
 if(!/^[\p{L}\p{N}_.@-]{1,64}$/u.test(account)||displayName.length>80)throw Error('账号或姓名格式无效');
 const client=await pool.connect();try{
  await client.query('BEGIN');
  const {rows}=await client.query("INSERT INTO profit.users(account,display_name,password_hash,role,must_change_password) VALUES($1,$2,$3,'user',true) RETURNING id",[account,displayName,await hashPassword(INITIAL_PASSWORD)]);
  await readUserSettings(client,ownerForUser(rows[0].id));await client.query('COMMIT');console.log('用户已创建，初始密码为 88888888aA，首次登录必须修改。');
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}finally{rl.close();await pool.end()}
