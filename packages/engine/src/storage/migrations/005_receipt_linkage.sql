-- MND-004: Denormalized receipt linkage columns for queryability
-- These mirror fields from the receipt JSONB but allow direct SQL filtering/indexing.

ALTER TABLE runs ADD COLUMN IF NOT EXISTS receipt_tx_hash TEXT;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS receipt_contract TEXT;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS receipt_chain_id INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS receipt_published_at TEXT;

CREATE INDEX IF NOT EXISTS idx_runs_receipt_tx_hash ON runs(receipt_tx_hash)
  WHERE receipt_tx_hash IS NOT NULL;
