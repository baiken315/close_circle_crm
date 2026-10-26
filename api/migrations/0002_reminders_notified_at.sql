-- Migration 0002: add notified_at to reminders
-- Prevents duplicate push notifications on repeated cron ticks for the same reminder.

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
