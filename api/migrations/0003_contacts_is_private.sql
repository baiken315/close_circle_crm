-- Migration 0003: Add is_private to contacts
-- Shared contacts (is_private = false) are visible to all household users.
-- Private contacts (is_private = true) are visible only to their creator (user_id).
-- Run once against the live MotherDuck database.

-- DuckDB does not support NOT NULL constraints in ALTER TABLE ADD COLUMN.
-- We add with a DEFAULT, then backfill any NULLs (none expected on a fresh add).
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
UPDATE contacts SET is_private = false WHERE is_private IS NULL;
