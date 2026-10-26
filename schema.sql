-- Close Circle v2 — DuckDB Schema
-- All primary keys are TEXT (UUIDs generated in application code)
-- All timestamps stored as TIMESTAMPTZ

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  full_name TEXT NOT NULL,
  nickname TEXT,
  organization TEXT,
  title TEXT,
  date_of_birth DATE,
  type TEXT DEFAULT 'person',
  notes TEXT,
  is_self BOOLEAN DEFAULT false,
  is_private BOOLEAN NOT NULL DEFAULT false,
  -- TEXT (JSON array string), NOT TEXT[] — MotherDuck raises a false FK constraint error
  -- when updating a native VARCHAR[] column on any row that has child rows in other tables
  -- (contact_methods, interactions, important_dates, reminders, etc.). Storing as JSON TEXT
  -- and parsing in the application layer is the workaround. Do not change back to TEXT[].
  groups TEXT,
  factoids TEXT,
  photo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON contacts(user_id);
CREATE INDEX IF NOT EXISTS contacts_full_name_idx ON contacts(full_name);

CREATE TABLE IF NOT EXISTS contact_methods (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL, -- no FK: DuckDB UPDATE bug (see migrations/0004)
  type TEXT NOT NULL, -- email | phone | address | social
  value TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS contact_methods_contact_id_idx ON contact_methods(contact_id);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL, -- no FK: DuckDB UPDATE bug (see migrations/0004)
  related_contact_id TEXT NOT NULL, -- no FK: DuckDB UPDATE bug (see migrations/0004)
  relationship_type TEXT NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS relationships_contact_id_idx ON relationships(contact_id);

CREATE TABLE IF NOT EXISTS interactions (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL, -- no FK: DuckDB UPDATE bug (see migrations/0004)
  user_id TEXT NOT NULL, -- no FK: DuckDB UPDATE bug (see migrations/0004)
  type TEXT NOT NULL, -- meeting | call | email | text | other
  date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interactions_contact_id_idx ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS interactions_user_id_idx ON interactions(user_id);

CREATE TABLE IF NOT EXISTS important_dates (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL, -- no FK: DuckDB UPDATE bug (see migrations/0004)
  user_id TEXT NOT NULL, -- no FK: DuckDB UPDATE bug (see migrations/0004)
  title TEXT NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  last_notified_year INTEGER
);

CREATE INDEX IF NOT EXISTS important_dates_contact_id_idx ON important_dates(contact_id);
CREATE INDEX IF NOT EXISTS important_dates_user_id_idx ON important_dates(user_id);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  contact_id TEXT, -- no FK: DuckDB UPDATE bug (see migrations/0004)
  user_id TEXT NOT NULL, -- no FK: DuckDB UPDATE bug (see migrations/0004)
  title TEXT NOT NULL,
  notes TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  recurrence_days INTEGER,
  recurrence_annual BOOLEAN,
  recurrence_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reminders_user_id_idx ON reminders(user_id);
CREATE INDEX IF NOT EXISTS reminders_contact_id_idx ON reminders(contact_id);
CREATE INDEX IF NOT EXISTS reminders_due_date_idx ON reminders(due_date);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON chat_sessions(user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id),
  role TEXT NOT NULL, -- user | assistant
  content TEXT NOT NULL,
  tool_calls JSON,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON chat_messages(session_id);

CREATE TABLE IF NOT EXISTS device_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_tokens_user_id_idx ON device_tokens(user_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  theme TEXT DEFAULT 'system',
  accent_color TEXT DEFAULT '250,84%,60%',
  font_family TEXT DEFAULT 'Inter',
  layout TEXT DEFAULT 'default',
  custom_css TEXT,
  settings JSON
);
