BEGIN;
-- The records table remains the current order. Version snapshots never add list rows.
LOCK TABLE profit.records IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS profit.record_versions (
 record_id uuid NOT NULL REFERENCES profit.records(id) ON DELETE CASCADE,
 version integer NOT NULL CHECK(version>0),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 saved_at timestamptz NOT NULL,
 PRIMARY KEY(record_id,version)
);

CREATE OR REPLACE FUNCTION profit.capture_record_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  INSERT INTO profit.record_versions(record_id,version,data,saved_at)
  VALUES(OLD.id,OLD.version,to_jsonb(OLD)-'previous_snapshot'-'previous_saved_at'-'previous_version',OLD.updated_at)
  ON CONFLICT(record_id,version) DO NOTHING;
 END IF;
 INSERT INTO profit.record_versions(record_id,version,data,saved_at)
 VALUES(NEW.id,NEW.version,to_jsonb(NEW)-'previous_snapshot'-'previous_saved_at'-'previous_version',NEW.updated_at)
 ON CONFLICT(record_id,version) DO NOTHING;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS capture_record_version ON profit.records;
CREATE TRIGGER capture_record_version AFTER INSERT OR UPDATE OF snapshot,version ON profit.records
FOR EACH ROW EXECUTE FUNCTION profit.capture_record_version();

-- Preserve the exact stored snapshot and result, without applying today's formulas.
INSERT INTO profit.record_versions(record_id,version,data,saved_at)
SELECT id,version,to_jsonb(r)-'previous_snapshot'-'previous_saved_at'-'previous_version',updated_at
FROM profit.records r ON CONFLICT(record_id,version) DO NOTHING;
INSERT INTO profit.record_versions(record_id,version,data,saved_at)
SELECT id,COALESCE(previous_version,GREATEST(1,version-1)),
 (to_jsonb(r)-'previous_snapshot'-'previous_saved_at'-'previous_version') || jsonb_build_object(
  'version',COALESCE(previous_version,GREATEST(1,version-1)),
  'snapshot',previous_snapshot,'updated_at',COALESCE(previous_saved_at,created_at),
  'name',COALESCE(previous_snapshot->'identity'->>'name',name),
  'spec_code',COALESCE(previous_snapshot->'identity'->>'specCode',spec_code),
  'product_code',COALESCE(previous_snapshot->'identity'->>'productCode',product_code),
  'category',COALESCE(previous_snapshot->'identity'->>'category',previous_snapshot->'fields'->>'attribute',category),
  'net_rmb',previous_snapshot->'result'->'netRmb',
  'net_usd',previous_snapshot->'result'->'netUsd',
  'margin',previous_snapshot->'result'->'margin'),
 COALESCE(previous_saved_at,created_at)
FROM profit.records r WHERE previous_snapshot IS NOT NULL
ON CONFLICT(record_id,version) DO NOTHING;
COMMIT;
