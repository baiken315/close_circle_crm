import type { Database } from '../db.js';

export async function searchContacts(input: { query: string }, db: Database, userId: string) {
  const pattern = `%${input.query}%`;
  const contacts = await db.query<Record<string, unknown>>(
    `SELECT * FROM contacts
     WHERE user_id = ?
     AND (full_name ILIKE ? OR nickname ILIKE ? OR organization ILIKE ? OR notes ILIKE ?)
     ORDER BY full_name ASC
     LIMIT 20`,
    [userId, pattern, pattern, pattern, pattern]
  );

  if (contacts.length === 0) return [];

  const ids = contacts.map((c) => c['id'] as string);
  const placeholders = ids.map(() => '?').join(', ');
  const methods = await db.query<Record<string, unknown>>(
    `SELECT * FROM contact_methods WHERE contact_id IN (${placeholders})`,
    ids
  );

  const methodsByContact = new Map<string, Record<string, unknown>[]>();
  for (const m of methods) {
    const cid = m['contact_id'] as string;
    const arr = methodsByContact.get(cid) ?? [];
    arr.push(m);
    methodsByContact.set(cid, arr);
  }

  return contacts.map((c) => ({
    ...c,
    contact_methods: methodsByContact.get(c['id'] as string) ?? [],
  }));
}

export async function getContact(input: { id: string }, db: Database, userId: string) {
  const contact = await db.queryOne<Record<string, unknown>>(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?',
    [input.id, userId]
  );
  if (!contact) return null;

  const methods = await db.query<Record<string, unknown>>(
    'SELECT * FROM contact_methods WHERE contact_id = ? ORDER BY is_primary DESC',
    [input.id]
  );

  const interactions = await db.query<Record<string, unknown>>(
    'SELECT * FROM interactions WHERE contact_id = ? AND user_id = ? ORDER BY date DESC LIMIT 10',
    [input.id, userId]
  );

  const dates = await db.query<Record<string, unknown>>(
    'SELECT * FROM important_dates WHERE contact_id = ? AND user_id = ?',
    [input.id, userId]
  );

  return { ...contact, contact_methods: methods, recent_interactions: interactions, important_dates: dates };
}

export async function createContact(
  input: {
    full_name: string;
    nickname?: string;
    organization?: string;
    title?: string;
    notes?: string;
    groups?: string[];
    factoids?: string[];
  },
  db: Database,
  userId: string
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO contacts (id, user_id, full_name, nickname, organization, title, notes, groups, factoids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, userId, input.full_name, input.nickname ?? null,
      input.organization ?? null, input.title ?? null, input.notes ?? null,
      JSON.stringify(input.groups ?? []), JSON.stringify(input.factoids ?? []),
      now, now,
    ]
  );

  return db.queryOne<Record<string, unknown>>(
    'SELECT * FROM contacts WHERE id = ?',
    [id]
  );
}

export async function updateContact(
  input: {
    id: string;
    full_name?: string;
    nickname?: string;
    organization?: string;
    title?: string;
    notes?: string;
    groups?: string[];
    factoids?: string[];
  },
  db: Database,
  userId: string
) {
  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?',
    [input.id, userId]
  );
  if (!existing) return null;

  const setClauses: string[] = ['updated_at = ?'];
  const values: unknown[] = [new Date().toISOString()];

  if (input.full_name !== undefined) { setClauses.push('full_name = ?'); values.push(input.full_name); }
  if (input.nickname !== undefined) { setClauses.push('nickname = ?'); values.push(input.nickname); }
  if (input.organization !== undefined) { setClauses.push('organization = ?'); values.push(input.organization); }
  if (input.title !== undefined) { setClauses.push('title = ?'); values.push(input.title); }
  if (input.notes !== undefined) { setClauses.push('notes = ?'); values.push(input.notes); }
  if (input.groups !== undefined) { setClauses.push('groups = ?'); values.push(JSON.stringify(input.groups)); }
  if (input.factoids !== undefined) { setClauses.push('factoids = ?'); values.push(JSON.stringify(input.factoids)); }

  values.push(input.id, userId);
  await db.execute(
    `UPDATE contacts SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
    values
  );

  return db.queryOne<Record<string, unknown>>(
    'SELECT * FROM contacts WHERE id = ?',
    [input.id]
  );
}
