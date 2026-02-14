-- 001_initial.sql
-- Initial schema for simvi.be Postgres storage

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB NOT NULL,
  landing_extract JSONB,
  report JSONB,
  actuals JSONB,
  diagnostics JSONB,
  receipt JSONB,
  variant_of TEXT REFERENCES runs(id),
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id);
CREATE INDEX IF NOT EXISTS idx_events_run_id_timestamp ON events(run_id, timestamp);

CREATE TABLE IF NOT EXISTS agent_outputs (
  id SERIAL PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL,
  data JSONB NOT NULL,
  UNIQUE(run_id, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_outputs_run_id ON agent_outputs(run_id);

CREATE TABLE IF NOT EXISTS calibration_priors (
  key TEXT PRIMARY KEY,
  signup_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  pay_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  bounce_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  sample_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
