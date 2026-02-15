-- 003_personas_table.sql
-- Persona registry table: ops-friendly persona management without redeploying code.

CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  version_hash TEXT NOT NULL,
  engine_fields JSONB NOT NULL,
  metadata JSONB,
  source_format TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personas_status ON personas(status);
