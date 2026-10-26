import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db.js';
import type { AppContext } from '../auth.js';

export const datesRouter = new Hono<AppContext>();

const ImportantDateSchema = z.object({
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  notes: z.string().optional(),
});

// GET /api/dates — all important dates across contacts
datesRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env);
  const contactId = c.req.query('contact_id');

  let sql = `
    SELECT d.*, c.full_name as contact_name
    FROM important_dates d
    JOIN contacts c ON d.contact_id = c.id
    WHERE d.user_id = ?
  `;
  const params: unknown[] = [userId];

  if (contactId) {
    sql += ` AND d.contact_id = ?`;
    params.push(contactId);
  }

  sql += ` ORDER BY extract(month FROM d.date), extract(day FROM d.date) ASC`;

  let dates: Record<string, unknown>[];
  try {
    dates = await db.query<Record<string, unknown>>(sql, params);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: 'Database error', detail: message }, 500);
  }

  // Calculate days until for current year
  // DuckDB returns DATE columns as JS Date objects, not strings
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const enriched = dates.map((d) => {
    const raw = d['date'];
    const dateObj = raw instanceof Date ? raw : new Date(raw as string);
    const month = dateObj.getUTCMonth();
    const day = dateObj.getUTCDate();
    const thisYear = new Date(today.getFullYear(), month, day);
    if (thisYear < today) {
      thisYear.setFullYear(today.getFullYear() + 1);
    }
    // round, not ceil: a DST change between the two midnights adds/removes an hour
    const daysUntil = Math.round((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    // Normalize date to ISO string for consistent frontend consumption
    const dateISO = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(dateObj.getUTCDate()).padStart(2, '0')}`;
    return { ...d, date: dateISO, days_until: daysUntil };
  });
  // Soonest next occurrence first (SQL orders by calendar month/day, which puts January before October)
  enriched.sort((a, b) => a.days_until - b.days_until);

  // Split into upcoming (next 90 days) and all
  const upcoming = enriched.filter((d) => (d['days_until'] as number) <= 90);

  return c.json({ data: { upcoming, all: enriched } });
});

// GET /api/contacts/:id/dates
datesRouter.get('/contacts/:contactId/dates', async (c) => {
  const userId = c.get('userId');
  const contactId = c.req.param('contactId');
  const db = createDb(c.env);

  const contact = await db.queryOne<{ id: string }>(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?',
    [contactId, userId]
  );
  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404);
  }

  const dates = await db.query<Record<string, unknown>>(
    `SELECT * FROM important_dates WHERE contact_id = ? AND user_id = ? ORDER BY date`,
    [contactId, userId]
  );

  return c.json({ data: dates });
});

// POST /api/contacts/:id/dates
datesRouter.post('/contacts/:contactId/dates', async (c) => {
  const userId = c.get('userId');
  const contactId = c.req.param('contactId');
  const body = await c.req.json().catch(() => null);
  const parsed = ImportantDateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env);

  const contact = await db.queryOne<{ id: string }>(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?',
    [contactId, userId]
  );
  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404);
  }

  const id = crypto.randomUUID();
  const { title, date, notes } = parsed.data;

  await db.execute(
    `INSERT INTO important_dates (id, contact_id, user_id, title, date, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, contactId, userId, title, date, notes ?? null]
  );

  const dateRecord = await db.queryOne<Record<string, unknown>>(
    'SELECT * FROM important_dates WHERE id = ?',
    [id]
  );

  return c.json({ data: dateRecord }, 201);
});

// PATCH /api/contacts/:id/dates/:dateId
datesRouter.patch('/contacts/:contactId/dates/:dateId', async (c) => {
  const userId = c.get('userId');
  const dateId = c.req.param('dateId');
  const body = await c.req.json().catch(() => null);
  const parsed = ImportantDateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM important_dates WHERE id = ? AND user_id = ?',
    [dateId, userId]
  );
  if (!existing) {
    return c.json({ error: 'Date not found' }, 404);
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  if (parsed.data.title !== undefined) { setClauses.push('title = ?'); values.push(parsed.data.title); }
  if (parsed.data.date !== undefined) { setClauses.push('date = ?'); values.push(parsed.data.date); }
  if (parsed.data.notes !== undefined) { setClauses.push('notes = ?'); values.push(parsed.data.notes || null); }

  if (setClauses.length > 0) {
    values.push(dateId);
    await db.execute(`UPDATE important_dates SET ${setClauses.join(', ')} WHERE id = ?`, values);
  }

  const updated = await db.queryOne<Record<string, unknown>>(
    'SELECT * FROM important_dates WHERE id = ?',
    [dateId]
  );
  const raw = updated?.['date'];
  if (raw instanceof Date) {
    const dateISO = `${raw.getUTCFullYear()}-${String(raw.getUTCMonth() + 1).padStart(2, '0')}-${String(raw.getUTCDate()).padStart(2, '0')}`;
    return c.json({ data: { ...updated, date: dateISO } });
  }
  return c.json({ data: updated });
});

// DELETE /api/contacts/:id/dates/:dateId
datesRouter.delete('/contacts/:contactId/dates/:dateId', async (c) => {
  const userId = c.get('userId');
  const dateId = c.req.param('dateId');
  const db = createDb(c.env);

  // Check only user_id — contact_id may be stale (e.g. contact recreated after import)
  const dateRecord = await db.queryOne<{ id: string }>(
    'SELECT id FROM important_dates WHERE id = ? AND user_id = ?',
    [dateId, userId]
  );
  if (!dateRecord) {
    return c.json({ error: 'Date not found' }, 404);
  }

  await db.execute('DELETE FROM important_dates WHERE id = ?', [dateId]);
  return c.json({ data: { success: true } });
});
