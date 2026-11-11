-- Upgrade legacy username accounts while retaining stable IDs for existing links.
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
