import {readFile} from 'node:fs/promises';
import {pool} from './db.js';
import {seedInitialUsers} from './auth.js';
try{await pool.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));await pool.query(await readFile(new URL('./record-versions.sql',import.meta.url),'utf8'));await pool.query(await readFile(new URL('./auth.sql',import.meta.url),'utf8'));await seedInitialUsers(pool);console.log('profit schema ready in chaoren_profit_dev')}
finally{await pool.end()}
