-- Migration 0004: Drop FK constraints from tables that reference contacts.
--
-- DuckDB implements UPDATE as an internal DELETE+INSERT. During the delete phase
-- it checks whether any FK in a child table still references the row being removed,
-- and raises a false constraint error even though the row is being re-inserted
-- immediately. This makes it impossible to UPDATE any column on a contacts row
-- that has child rows (contact_methods, interactions, important_dates, reminders).
--
-- Fix: drop the FK constraints from child tables. Referential integrity is
-- enforced at the application layer (user_id scoping, cascaded deletes, etc.).
-- Do NOT add REFERENCES back to these tables.

-- contact_methods
CREATE TABLE contact_methods_bk AS SELECT * FROM contact_methods;
DROP TABLE contact_methods;
CREATE TABLE contact_methods (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN DEFAULT false
);
INSERT INTO contact_methods SELECT * FROM contact_methods_bk;
DROP TABLE contact_methods_bk;
CREATE INDEX IF NOT EXISTS contact_methods_contact_id_idx ON contact_methods(contact_id);

-- relationships
CREATE TABLE relationships_bk AS SELECT * FROM relationships;
DROP TABLE relationships;
CREATE TABLE relationships (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  related_contact_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  notes TEXT
);
INSERT INTO relationships SELECT * FROM relationships_bk;
DROP TABLE relationships_bk;
CREATE INDEX IF NOT EXISTS relationships_contact_id_idx ON relationships(contact_id);

-- interactions
CREATE TABLE interactions_bk AS SELECT * FROM interactions;
DROP TABLE interactions;
CREATE TABLE interactions (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO interactions SELECT * FROM interactions_bk;
DROP TABLE interactions_bk;
CREATE INDEX IF NOT EXISTS interactions_contact_id_idx ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS interactions_user_id_idx ON interactions(user_id);

-- important_dates
CREATE TABLE important_dates_bk AS SELECT * FROM important_dates;
DROP TABLE important_dates;
CREATE TABLE important_dates (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  last_notified_year INTEGER
);
INSERT INTO important_dates SELECT * FROM important_dates_bk;
DROP TABLE important_dates_bk;
CREATE INDEX IF NOT EXISTS important_dates_contact_id_idx ON important_dates(contact_id);
CREATE INDEX IF NOT EXISTS important_dates_user_id_idx ON important_dates(user_id);

-- reminders (contact_id is nullable)
CREATE TABLE reminders_bk AS SELECT * FROM reminders;
DROP TABLE reminders;
CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  contact_id TEXT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  recurrence_days INTEGER,
  recurrence_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO reminders SELECT * FROM reminders_bk;
DROP TABLE reminders_bk;
CREATE INDEX IF NOT EXISTS reminders_user_id_idx ON reminders(user_id);
CREATE INDEX IF NOT EXISTS reminders_contact_id_idx ON reminders(contact_id);
CREATE INDEX IF NOT EXISTS reminders_due_date_idx ON reminders(due_date);
