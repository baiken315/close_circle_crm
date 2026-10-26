-- Adds annual (leap-year-safe) recurrence to reminders.
-- When set, the next occurrence is the same month/day next year
-- (Feb 29 rolls to Feb 28 on non-leap years) instead of +N days.
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recurrence_annual BOOLEAN;
