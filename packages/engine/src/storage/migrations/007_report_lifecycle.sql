-- MND-016: Living report data model
-- Adds report lifecycle status, version tracking, and revision history

ALTER TABLE runs ADD COLUMN IF NOT EXISTS report_status TEXT DEFAULT 'open';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS report_version INTEGER DEFAULT 1;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS report_lifecycle JSONB;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS report_revisions JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_runs_report_status ON runs(report_status);
