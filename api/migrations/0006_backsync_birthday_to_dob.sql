-- Migration 0006: Back-sync Birthday important dates → contacts.date_of_birth
--
-- Before this migration the DOB→Birthday sync only ran on new saves.
-- 44 contacts had a Birthday in important_dates but nothing in date_of_birth,
-- and some contacts (e.g. Benjamin Aiken) had DOB set but a non-canonical
-- Birthday entry (random UUID instead of the deterministic <contactId>-dob ID).
--
-- Steps:
--   1. Fill contacts.date_of_birth from the first Birthday entry where DOB is null.
--   2. Delete all non-canonical Birthday entries for contacts that have a DOB.
--   3. Insert the canonical <contactId>-dob Birthday entry for every contact
--      with a DOB that doesn't already have one.

-- Step 1: fill missing date_of_birth from Birthday important dates
UPDATE contacts
SET date_of_birth = (
  SELECT d.date
  FROM important_dates d
  WHERE d.contact_id = contacts.id
    AND d.title = 'Birthday'
    AND d.id NOT LIKE '%-dob'
  ORDER BY d.id
  LIMIT 1
)
WHERE date_of_birth IS NULL
  AND id IN (
    SELECT DISTINCT contact_id
    FROM important_dates
    WHERE title = 'Birthday'
      AND id NOT LIKE '%-dob'
  );

-- Step 2: remove non-canonical Birthday entries for contacts that now have a DOB
DELETE FROM important_dates
WHERE title = 'Birthday'
  AND id NOT LIKE '%-dob'
  AND contact_id IN (
    SELECT id FROM contacts WHERE date_of_birth IS NOT NULL
  );

-- Step 3: create canonical -dob entries for all contacts with a DOB that lack one
INSERT INTO important_dates (id, contact_id, user_id, title, date, notes, last_notified_year)
SELECT
  c.id || '-dob',
  c.id,
  c.user_id,
  'Birthday',
  c.date_of_birth,
  NULL,
  NULL
FROM contacts c
WHERE c.date_of_birth IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM important_dates d WHERE d.id = c.id || '-dob'
  );
