CREATE SCHEMA IF NOT EXISTS profit;
CREATE TABLE IF NOT EXISTS profit.users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account varchar(64) NOT NULL UNIQUE,
 display_name varchar(80) NOT NULL,password_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profit.sessions (
 token_hash char(64) PRIMARY KEY,user_id uuid NOT NULL REFERENCES profit.users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profit.user_settings (
 user_id uuid PRIMARY KEY REFERENCES profit.users(id) ON DELETE CASCADE,
 fields jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profit.records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES profit.users(id) ON DELETE SET NULL,
 market varchar(8) NOT NULL DEFAULT 'US' CHECK(market='US'),order_number varchar(200),
 name varchar(200) NOT NULL,category varchar(100) NOT NULL,product_spec varchar(200),spec_code varchar(200) NOT NULL,product_code varchar(200) NOT NULL,
 operator_name varchar(80),
 snapshot jsonb NOT NULL,previous_snapshot jsonb,previous_saved_at timestamptz,previous_version integer,
 version integer NOT NULL DEFAULT 1,net_rmb numeric NOT NULL,net_usd numeric NOT NULL,margin numeric,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,market,order_number,name,spec_code,product_code)
);
CREATE INDEX IF NOT EXISTS records_lookup ON profit.records(user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS records_category_time ON profit.records(user_id,category,updated_at DESC);
ALTER TABLE profit.records ADD COLUMN IF NOT EXISTS operator_name varchar(80);
ALTER TABLE profit.records ADD COLUMN IF NOT EXISTS product_spec varchar(200);
ALTER TABLE profit.records ADD COLUMN IF NOT EXISTS previous_version integer;
UPDATE profit.records SET previous_version=GREATEST(1,version-1) WHERE previous_snapshot IS NOT NULL AND previous_version IS NULL;
ALTER TABLE profit.records ALTER COLUMN order_number DROP NOT NULL;
ALTER TABLE profit.records ALTER COLUMN product_spec DROP NOT NULL;
ALTER TABLE profit.records ALTER COLUMN product_spec DROP DEFAULT;
ALTER TABLE profit.records ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE profit.records DROP CONSTRAINT IF EXISTS records_user_id_fkey;
ALTER TABLE profit.records ADD CONSTRAINT records_user_id_fkey FOREIGN KEY(user_id) REFERENCES profit.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS records_shared_identity ON profit.records(market,order_number,name,product_spec,spec_code,product_code) WHERE user_id IS NULL;
DROP INDEX IF EXISTS profit.records_shared_current_identity;
CREATE TABLE IF NOT EXISTS profit.global_settings (
 id integer PRIMARY KEY CHECK(id=1),fields jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now()
);
UPDATE profit.records AS r SET operator_name=u.display_name FROM profit.users AS u WHERE r.user_id=u.id AND r.operator_name IS NULL;
UPDATE profit.records SET
 snapshot=jsonb_set(snapshot,'{fields}',COALESCE(snapshot->'fields','{}'::jsonb)-ARRAY['length','width','height','weight','packType'])-'quote'-'adoptedQuote'-'rateTable',
 previous_snapshot=CASE WHEN previous_snapshot IS NULL THEN NULL ELSE jsonb_set(previous_snapshot,'{fields}',COALESCE(previous_snapshot->'fields','{}'::jsonb)-ARRAY['length','width','height','weight','packType'])-'quote'-'adoptedQuote'-'rateTable' END
WHERE (snapshot->'fields') ?| ARRAY['length','width','height','weight','packType']
 OR snapshot ?| ARRAY['quote','adoptedQuote','rateTable']
 OR (previous_snapshot->'fields') ?| ARRAY['length','width','height','weight','packType']
 OR previous_snapshot ?| ARRAY['quote','adoptedQuote','rateTable'];
