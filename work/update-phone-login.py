from pathlib import Path

migration='''-- Upgrade legacy username accounts while retaining stable IDs for existing links.
BEGIN;
DO $migration$
DECLARE
 users_table oid := to_regclass('profit.users');
 old_primary record;
 linked jsonb := '[]'::jsonb;
 item jsonb;
 id_column smallint;
BEGIN
 IF users_table IS NULL THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=users_table AND attname='account' AND NOT attisdropped)
    AND NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=users_table AND attname='phone' AND NOT attisdropped) THEN
  ALTER TABLE profit.users RENAME COLUMN account TO phone;
 END IF;
 -- Only the three original demo login names receive the agreed demo numbers.
 UPDATE profit.users SET phone=CASE phone WHEN '小红' THEN '13800000001' WHEN '小蓝' THEN '13800000002' WHEN '小白' THEN '13800000003' END
 WHERE phone IN ('小红','小蓝','小白');
 IF EXISTS(SELECT 1 FROM profit.users WHERE phone IS NULL OR phone !~ '^1[3-9][0-9]{9}$') THEN
  RAISE EXCEPTION 'Existing user requires a valid mobile number before migration';
 END IF;
 SELECT attnum INTO id_column FROM pg_attribute WHERE attrelid=users_table AND attname='id' AND NOT attisdropped;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=users_table AND contype='u' AND conkey=ARRAY[id_column]) THEN
  ALTER TABLE profit.users ADD CONSTRAINT users_id_key UNIQUE(id);
 END IF;
 SELECT c.conname,c.conindid,pg_get_constraintdef(c.oid) AS definition INTO old_primary
 FROM pg_constraint c WHERE c.conrelid=users_table AND c.contype='p';
 IF old_primary.conname IS NOT NULL AND old_primary.definition<>'PRIMARY KEY (phone)' THEN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',t.relname,'name',c.conname,'definition',pg_get_constraintdef(c.oid))),'[]'::jsonb)
   INTO linked FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
   WHERE c.contype='f' AND c.confrelid=users_table AND c.conindid=old_primary.conindid;
  FOR item IN SELECT value FROM jsonb_array_elements(linked) LOOP
   EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',item->>'schema',item->>'table',item->>'name');
  END LOOP;
  EXECUTE format('ALTER TABLE profit.users DROP CONSTRAINT %I',old_primary.conname);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=users_table AND contype='p') THEN
  ALTER TABLE profit.users ADD CONSTRAINT users_pkey PRIMARY KEY(phone);
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(linked) LOOP
  EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s',item->>'schema',item->>'table',item->>'name',item->>'definition');
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=users_table AND conname='users_phone_format') THEN
  ALTER TABLE profit.users ADD CONSTRAINT users_phone_format CHECK(phone ~ '^1[3-9][0-9]{9}$');
 END IF;
END;
$migration$;
DROP INDEX IF EXISTS profit.users_account_case_unique;
COMMIT;
'''
Path('apps/api/src/phone-auth.sql').write_text(migration)
p=Path('apps/api/src/schema.sql');s=p.read_text().replace('id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account varchar(64) NOT NULL UNIQUE,','id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),phone varchar(11) PRIMARY KEY CONSTRAINT users_phone_format CHECK(phone ~ \'^1[3-9][0-9]{9}$\'),');p.write_text(s)
p=Path('apps/api/src/auth.sql');s=p.read_text().replace('CREATE UNIQUE INDEX IF NOT EXISTS users_account_case_unique ON profit.users(lower(account));','-- The phone number is the primary key; stable UUIDs retain existing relations.');p.write_text(s)
p=Path('apps/api/src/migrate.ts');s=p.read_text().replace("try{await pool.query(await readFile(new URL('./schema.sql'", "try{await pool.query(await readFile(new URL('./phone-auth.sql',import.meta.url),'utf8'));await pool.query(await readFile(new URL('./schema.sql'");p.write_text(s)
p=Path('apps/api/src/auth.ts');s=p.read_text()
s=s.replace('id:string;account:string;','id:string;phone:string;').replace('account:String(row.account)','phone:String(row.phone)')
s=s.replace("const accountSchema=z.string().trim().normalize().min(1).max(64).regex(/^[\\p{L}\\p{N}_.@-]+$/u,'账号仅支持中文、字母、数字、点、下划线、@ 和短横线');", "export const phoneSchema=z.string().trim().regex(/^1[3-9][0-9]{9}$/,'请输入有效的 11 位中国大陆手机号');")
s=s.replace('account:accountSchema','phone:phoneSchema')
s=s.replace("for(const [account,role]of [['小红','admin'],['小蓝','user'],['小白','user']])", "for(const [phone,displayName,role]of [['13800000001','小红','admin'],['13800000002','小蓝','user'],['13800000003','小白','user']])")
s=s.replace('users(account,display_name,password_hash,role,must_change_password) VALUES($1,$1,$2,$3,true)', 'users(phone,display_name,password_hash,role,must_change_password) VALUES($1,$2,$3,$4,true)').replace('[account,await hashPassword(INITIAL_PASSWORD),role]','[phone,displayName,await hashPassword(INITIAL_PASSWORD),role]')
s=s.replace("if(!parsed.success)throw fail('请输入有效的账号和密码');", "if(!parsed.success)throw fail(parsed.error.issues[0]?.message||'请输入有效的手机号和密码');")
s=s.replace('const {account,password}=parsed.data;', 'const {phone,password}=parsed.data;').replace("WHERE lower(account)=lower($1)',[account]", "WHERE phone=$1',[phone]")
s=s.replace('SELECT id,account,display_name', 'SELECT id,phone,display_name')
s=s.replace("WHERE lower(account)=lower($1)',[body.account]", "WHERE phone=$1',[body.phone]")
s=s.replace("'该账号已存在'", "'该手机号已存在'")
s=s.replace('users(account,display_name,password_hash,role,must_change_password,created_by)', 'users(phone,display_name,password_hash,role,must_change_password,created_by)').replace('[body.account,body.displayName,','[body.phone,body.displayName,')
# Return precise phone/name validation failures to the administrator.
s=s.replace("const body=userSchema.parse(request.body),admin=requireUser(request),client=await db.connect();", "const parsed=userSchema.safeParse(request.body);if(!parsed.success)throw fail(parsed.error.issues[0]?.message||'请输入有效的手机号和姓名');\n  const body=parsed.data,admin=requireUser(request),client=await db.connect();")
s=s.replace('displayName:z.string().trim().min(1).max(80)',"displayName:z.string().trim().min(1,'请填写姓名').max(80,'姓名最多 80 个字')")
p.write_text(s)
p=Path('apps/api/src/create-user.ts');s=p.read_text().replace('ownerForUser}', 'ownerForUser,phoneSchema}')
s=s.replace("const account=(await rl.question('账号: ')).trim(),displayName=(await rl.question('姓名: ')).trim()||account;", "const phone=phoneSchema.parse(await rl.question('手机号: ')),displayName=(await rl.question('姓名: ')).trim();")
s=s.replace("if(!/^[\\p{L}\\p{N}_.@-]{1,64}$/u.test(account)||displayName.length>80)throw Error('账号或姓名格式无效');", "if(!displayName||displayName.length>80)throw Error('请填写 1–80 字的姓名');")
s=s.replace('users(account,display_name,','users(phone,display_name,').replace('[account,displayName,','[phone,displayName,');p.write_text(s)
for f in ['apps/web/app/auth-client.ts']:
 p=Path(f);p.write_text(p.read_text().replace('id:string;account:string;','id:string;phone:string;'))
p=Path('apps/web/app/login/page.tsx');s=p.read_text().replace('[account,setAccount]','[phone,setPhone]').replace('{account:account.trim(),password}','{phone:phone.trim(),password}').replace('使用管理员分配的账号登录','使用手机号登录工作台').replace('htmlFor="login-account">账号<input id="login-account" value={account} onChange={event=>setAccount(event.target.value)} required maxLength={64} autoComplete="username"','htmlFor="login-phone">手机号<input id="login-phone" type="tel" inputMode="tel" value={phone} onChange={event=>setPhone(event.target.value)} required pattern="1[3-9][0-9]{9}" title="请输入有效的 11 位中国大陆手机号" maxLength={11} autoComplete="username"').replace('placeholder="请输入账号"','placeholder="请输入 11 位手机号"');p.write_text(s)
p=Path('apps/web/app/admin/users/page.tsx');s=p.read_text().replace('[account,setAccount]','[phone,setPhone]').replace('{account:account.trim(),displayName:name.trim()||account.trim()}','{phone:phone.trim(),displayName:name.trim()}').replace("setAccount('')","setPhone('')").replace('<th>账号</th><th>姓名</th>','<th>手机号</th><th>姓名</th>').replace('{user.account}','{user.phone}')
s=s.replace('htmlFor="new-account">账号<input id="new-account" ref={firstField} value={account} onChange={event=>setAccount(event.target.value)} maxLength={64} autoComplete="off"', 'htmlFor="new-phone">手机号<input id="new-phone" ref={firstField} type="tel" inputMode="tel" value={phone} onChange={event=>setPhone(event.target.value)} pattern="1[3-9][0-9]{9}" title="请输入有效的 11 位中国大陆手机号" maxLength={11} autoComplete="off"')
s=s.replace('placeholder="不填则使用账号" disabled={pending}', 'placeholder="填写用户姓名" required disabled={pending}')
p.write_text(s)
