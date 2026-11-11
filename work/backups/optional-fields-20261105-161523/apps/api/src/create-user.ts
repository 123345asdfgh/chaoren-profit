import {hash} from '@node-rs/argon2';
import {pool} from './db.js';
import {createInterface} from 'node:readline/promises';
const rl=createInterface({input:process.stdin,output:process.stdout});
try{const account=(await rl.question('账号: ')).trim();const displayName=(await rl.question('显示名称: ')).trim();const password=await rl.question('密码（输入会显示在终端）: ');if(!/^[\w.-]{3,64}$/.test(account)||!displayName||password.length<12)throw Error('账号3–64位，名称必填，密码至少12位');await pool.query('INSERT INTO profit.users(account,display_name,password_hash) VALUES($1,$2,$3)',[account,displayName,await hash(password)]);console.log('用户已创建')}
finally{rl.close();await pool.end()}
