-- 002_persona_snapshots.sql
-- Add persona_snapshots column to runs table for reproducible reports.
-- Stores the exact persona definitions used at run start.

ALTER TABLE runs ADD COLUMN IF NOT EXISTS persona_snapshots JSONB;
