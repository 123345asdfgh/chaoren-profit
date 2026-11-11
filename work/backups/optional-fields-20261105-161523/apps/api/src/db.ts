import pg from 'pg';
const url=process.env.DATABASE_URL;
if(!url)throw new Error('DATABASE_URL is required');
if(new URL(url).pathname.slice(1)!=='chaoren_profit_dev')throw new Error('Refusing a database other than chaoren_profit_dev');
export const pool=new pg.Pool({connectionString:url,max:10});
