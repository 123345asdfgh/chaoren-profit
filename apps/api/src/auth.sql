BEGIN;
ALTER TABLE profit.users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user'));
ALTER TABLE profit.users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;
ALTER TABLE profit.users ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false;
ALTER TABLE profit.users ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE profit.users ADD COLUMN IF NOT EXISTS locked_until timestamptz;
ALTER TABLE profit.users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
ALTER TABLE profit.users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE profit.users ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profit.users(id) ON DELETE SET NULL;
-- The phone number is the primary key; stable UUIDs retain existing relations.
CREATE INDEX IF NOT EXISTS sessions_user ON profit.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON profit.sessions(expires_at);
ALTER TABLE profit.products ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES profit.users(id) ON DELETE SET NULL;
ALTER TABLE profit.products ADD COLUMN IF NOT EXISTS operator_name varchar(80);
CREATE TABLE IF NOT EXISTS profit.auth_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid REFERENCES profit.users(id) ON DELETE SET NULL,
 target_id uuid REFERENCES profit.users(id) ON DELETE SET NULL,
 action varchar(60) NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
