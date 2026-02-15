-- MND-011: Denormalized launch linkage columns for queryability.
-- These mirror fields from launch_record JSONB but allow direct SQL filtering/indexing.

ALTER TABLE runs ADD COLUMN IF NOT EXISTS launch_tx_hash TEXT;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS token_contract_address TEXT;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS nad_launch_url TEXT;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS launch_confirmed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_runs_launch_tx_hash ON runs(launch_tx_hash)
  WHERE launch_tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_runs_token_contract ON runs(token_contract_address)
  WHERE token_contract_address IS NOT NULL;
