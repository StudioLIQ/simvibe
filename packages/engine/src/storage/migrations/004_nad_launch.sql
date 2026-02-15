-- 004_nad_launch.sql
-- Add nad.fun launch fields to runs table for Report-to-Launch bridge (SIM-036).

ALTER TABLE runs ADD COLUMN IF NOT EXISTS launch_readiness JSONB;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS launch_input JSONB;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS launch_record JSONB;
