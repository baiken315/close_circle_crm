import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db.js';
import type { AppContext } from '../auth.js';

export const contactsRouter = new Hono<AppContext>();

const ContactMethodSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['email', 'phone', 'address', 'social']),
  value: z.string().min(1),
  label: z.string().nullable().optional(),
  is_primary: z.boolean().default(false),
});

const ContactSchema = z.object({
  full_name: z.string().min(1),
  nickname: z.string().optional(),
  organization: z.string().optional(),
  title: z.string().optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').nullable().optional(),
  type: z.string().optional().default('person'),
  notes: z.string().optional(),
  is_self: z.boolean().optional().default(false),
  is_private: z.boolean().optional().default(false),
  groups: z.array(z.string()).optional().default([]),
  factoids: z.array(z.string()).optional().default([]),
  contact_methods: z.array(ContactMethodSchema).optional().default([]),
});

const ContactUpdateSchema = ContactSchema.partial();

// Visibility predicate: shared contacts are visible to all; private contacts only to their owner.
// Returns SQL fragment and params to append after an existing WHERE clause.
function visibilityClause(userId: string): { sql: string; params: unknown[] } {
  return {
    sql: `(is_private = false OR user_id = ?)`,
    params: [userId],
  };
}

// Auto-sync a contact's date_of_birth to a stable "Birthday" important date entry.
// Uses a deterministic ID (contactId + "-dob") so it can be upserted/deleted without
// a separate lookup. Manual important-date entries are unaffected (they have random UUIDs).
async function syncDobBirthday(
  db: ReturnType<typeof createDb>,
  contactId: string,
  userId: string,
  dateOfBirth: string | null | undefined
): Promise<void> {
  const birthdayId = `${contactId}-dob`;
  // Always delete the existing auto-synced entry first, then re-insert if DOB is set.
  // (Simple DELETE+INSERT is more reliable across DuckDB versions than ON CONFLICT DO UPDATE.)
  await db.execute(`DELETE FROM important_dates WHERE id = ?`, [birthdayId]);
  if (dateOfBirth) {
    await db.execute(
      `INSERT INTO important_dates (id, contact_id, user_id, title, date, notes, last_notified_year)
       VALUES (?, ?, ?, 'Birthday', ?, NULL, NULL)`,
      [birthdayId, contactId, userId, dateOfBirth]
    );
  }
}

function normalizeDateField(value: unknown): string | null {
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof value === 'string' && value.length > 10) return value.slice(0, 10);
  return (value as string | null) ?? null;
}

function parseContactArrays(contact: Record<string, unknown>): Record<string, unknown> {
  return {
    ...contact,
    date_of_birth: normalizeDateField(contact['date_of_birth']),
    groups: typeof contact['groups'] === 'string' ? JSON.parse(contact['groups'] as string) : (contact['groups'] ?? []),
    factoids: typeof contact['factoids'] === 'string' ? JSON.parse(contact['factoids'] as string) : (contact['factoids'] ?? []),
  };
}

async function getContactWithMethods(db: ReturnType<typeof createDb>, contactId: string, userId: string) {
  const vis = visibilityClause(userId);
  const contact = await db.queryOne<Record<string, unknown>>(
    `SELECT * FROM contacts WHERE id = ? AND ${vis.sql}`,
    [contactId, ...vis.params]
  );
  if (!contact) return null;

  const methods = await db.query<Record<string, unknown>>(
    'SELECT * FROM contact_methods WHERE contact_id = ? ORDER BY is_primary DESC, type',
    [contactId]
  );

  return { ...parseContactArrays(contact), contact_methods: methods };
}

// GET /api/contacts
contactsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env);
  const search = c.req.query('search');
  const limit = parseInt(c.req.query('limit') ?? '1000', 10);
  const cursor = c.req.query('cursor');

  const vis = visibilityClause(userId);
  let sql = `SELECT * FROM contacts WHERE ${vis.sql}`;
  const params: unknown[] = [...vis.params];

  if (search) {
    sql += ` AND (full_name ILIKE ? OR nickname ILIKE ? OR organization ILIKE ? OR notes ILIKE ? OR groups ILIKE ?)`;
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern, pattern, pattern);
  }

  if (cursor) {
    sql += ` AND id > ?`;
    params.push(cursor);
  }

  sql += ` ORDER BY full_name ASC LIMIT ?`;
  params.push(limit);

  const contacts = await db.query<Record<string, unknown>>(sql, params);

  if (contacts.length === 0) {
    return c.json({ data: [] });
  }

  const contactIds = contacts.map((c) => c['id'] as string);
  const placeholders = contactIds.map(() => '?').join(', ');

  const allMethods = await db.query<Record<string, unknown>>(
    `SELECT * FROM contact_methods WHERE contact_id IN (${placeholders}) ORDER BY is_primary DESC`,
    contactIds
  );

  // Interaction counts are not scoped to user_id — all interactions on a contact count
  const interactionCounts = await db.query<{ contact_id: string; count: number }>(
    `SELECT contact_id, COUNT(*) AS count FROM interactions WHERE contact_id IN (${placeholders}) GROUP BY contact_id`,
    contactIds
  );

  const methodsByContact = new Map<string, Record<string, unknown>[]>();
  for (const method of allMethods) {
    const cid = method['contact_id'] as string;
    const existing = methodsByContact.get(cid) ?? [];
    existing.push(method);
    methodsByContact.set(cid, existing);
  }

  const countByContact = new Map<string, number>();
  for (const row of interactionCounts) {
    countByContact.set(row.contact_id, Number(row.count));
  }

  const enriched = contacts.map((contact) => ({
    ...parseContactArrays(contact),
    contact_methods: methodsByContact.get(contact['id'] as string) ?? [],
    interaction_count: countByContact.get(contact['id'] as string) ?? 0,
  }));

  return c.json({ data: enriched });
});

// POST /api/contacts
contactsRouter.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => null);
  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env);
  const { contact_methods, ...fields } = parsed.data;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const groupsStr = JSON.stringify(fields.groups ?? []);
  const factoidsStr = JSON.stringify(fields.factoids ?? []);

  await db.execute(
    `INSERT INTO contacts (id, user_id, full_name, nickname, organization, title, date_of_birth, type, notes, is_self, is_private, groups, factoids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, userId, fields.full_name, fields.nickname ?? null,
      fields.organization ?? null, fields.title ?? null,
      fields.date_of_birth ?? null, fields.type ?? 'person',
      fields.notes ?? null, fields.is_self ?? false,
      fields.is_private ?? false,
      groupsStr, factoidsStr, now, now,
    ]
  );

  for (const method of contact_methods) {
    const methodId = crypto.randomUUID();
    await db.execute(
      `INSERT INTO contact_methods (id, contact_id, type, value, label, is_primary) VALUES (?, ?, ?, ?, ?, ?)`,
      [methodId, id, method.type, method.value, method.label ?? null, method.is_primary]
    );
  }

  // Auto-sync DOB → Birthday important date
  await syncDobBirthday(db, id, userId, fields.date_of_birth ?? null);

  const contact = await getContactWithMethods(db, id, userId);
  return c.json({ data: contact }, 201);
});

// GET /api/contacts/:id
contactsRouter.get('/:id', async (c) => {
  const userId = c.get('userId');
  const contactId = c.req.param('id');
  const db = createDb(c.env);

  const contact = await getContactWithMethods(db, contactId, userId);
  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404);
  }

  // All interactions on a visible contact are visible regardless of who logged them
  const interactions = await db.query<Record<string, unknown>>(
    `SELECT * FROM interactions WHERE contact_id = ? ORDER BY date DESC LIMIT 10`,
    [contactId]
  );

  const dates = await db.query<Record<string, unknown>>(
    `SELECT * FROM important_dates WHERE contact_id = ? ORDER BY date`,
    [contactId]
  );

  // Normalize DATE values to YYYY-MM-DD strings (DuckDB returns DATE as JS Date objects)
  const normalizedDates = dates.map((d) => {
    const raw = d['date'];
    if (raw instanceof Date) {
      const dateISO = `${raw.getUTCFullYear()}-${String(raw.getUTCMonth() + 1).padStart(2, '0')}-${String(raw.getUTCDate()).padStart(2, '0')}`;
      return { ...d, date: dateISO };
    }
    return d;
  });

  return c.json({ data: { ...contact, interactions, important_dates: normalizedDates } });
});

// PATCH /api/contacts/:id
contactsRouter.patch('/:id', async (c) => {
  try {
  const userId = c.get('userId');
  const contactId = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = ContactUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env);

  // Check visibility first (404 if not visible at all)
  const vis = visibilityClause(userId);
  const existing = await db.queryOne<{ id: string; user_id: string; is_private: boolean }>(
    `SELECT id, user_id, is_private FROM contacts WHERE id = ? AND ${vis.sql}`,
    [contactId, ...vis.params]
  );
  if (!existing) {
    return c.json({ error: 'Contact not found' }, 404);
  }

  // Private contacts can only be edited by their owner
  if (existing.is_private && existing.user_id !== userId) {
    return c.json({ error: 'Contact not found' }, 404);
  }

  const { contact_methods, ...fields } = parsed.data;

  const setClauses: string[] = ['updated_at = ?'];
  const values: unknown[] = [new Date().toISOString()];

  if (fields.full_name !== undefined) { setClauses.push('full_name = ?'); values.push(fields.full_name); }
  if (fields.nickname !== undefined) { setClauses.push('nickname = ?'); values.push(fields.nickname); }
  if (fields.organization !== undefined) { setClauses.push('organization = ?'); values.push(fields.organization); }
  if (fields.title !== undefined) { setClauses.push('title = ?'); values.push(fields.title); }
  if (fields.date_of_birth !== undefined) { setClauses.push('date_of_birth = ?'); values.push(fields.date_of_birth); }
  if (fields.type !== undefined) { setClauses.push('type = ?'); values.push(fields.type); }
  if (fields.notes !== undefined) { setClauses.push('notes = ?'); values.push(fields.notes); }
  if (fields.is_self !== undefined) { setClauses.push('is_self = ?'); values.push(fields.is_self); }
  if (fields.is_private !== undefined) { setClauses.push('is_private = ?'); values.push(fields.is_private); }
  if (fields.groups !== undefined) { setClauses.push('groups = ?'); values.push(JSON.stringify(fields.groups)); }
  if (fields.factoids !== undefined) { setClauses.push('factoids = ?'); values.push(JSON.stringify(fields.factoids)); }

  // Plain UPDATE is safe — no snapshot/delete/restore needed around the UPDATE itself.
  // groups/factoids are TEXT (JSON strings), not VARCHAR[], which is intentional: MotherDuck
  // throws a false FK constraint error when updating a native array column on a row that has
  // any child rows in referencing tables. See schema.sql for the full explanation.
  // contact_methods delete/re-insert below is only done when the caller explicitly supplies
  // new methods, and runs after the UPDATE so the FK parent always exists.
  values.push(contactId);
  await db.execute(`UPDATE contacts SET ${setClauses.join(', ')} WHERE id = ?`, values);

  if (contact_methods !== undefined) {
    await db.execute('DELETE FROM contact_methods WHERE contact_id = ?', [contactId]);
    for (const method of contact_methods) {
      const methodId = (method['id'] as string | undefined) ?? crypto.randomUUID();
      await db.execute(
        `INSERT INTO contact_methods (id, contact_id, type, value, label, is_primary) VALUES (?, ?, ?, ?, ?, ?)`,
        [methodId, contactId, method['type'] as string, method['value'] as string, (method['label'] as string | null) ?? null, method['is_primary'] as boolean]
      );
    }
  }

  // Auto-sync DOB → Birthday important date (only when DOB is explicitly part of this update)
  if (fields.date_of_birth !== undefined) {
    await syncDobBirthday(db, contactId, userId, fields.date_of_birth ?? null);
  }

  const contact = await getContactWithMethods(db, contactId, userId);
  return c.json({ data: contact });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: 'Internal error', detail: message }, 500);
  }
});

// DELETE /api/contacts/:id — only the owner can delete
contactsRouter.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const contactId = c.req.param('id');
  const db = createDb(c.env);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?',
    [contactId, userId]
  );
  if (!existing) {
    return c.json({ error: 'Contact not found' }, 404);
  }

  await db.execute('DELETE FROM contacts WHERE id = ? AND user_id = ?', [contactId, userId]);

  return c.json({ data: { success: true } });
});
