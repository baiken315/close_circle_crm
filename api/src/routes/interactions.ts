import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db.js';
import type { AppContext } from '../auth.js';

export const interactionsRouter = new Hono<AppContext>();

const InteractionSchema = z.object({
  type: z.enum(['meeting', 'call', 'email', 'text', 'social', 'other']),
  date: z.string().datetime({ offset: true }),
  notes: z.string().optional(),
});

// GET /api/contacts/:id/interactions
interactionsRouter.get('/:contactId/interactions', async (c) => {
  const userId = c.get('userId');
  const contactId = c.req.param('contactId');
  const db = createDb(c.env);
  const limit = parseInt(c.req.query('limit') ?? '50', 10);

  // Verify contact belongs to user
  const contact = await db.queryOne<{ id: string }>(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?',
    [contactId, userId]
  );
  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404);
  }

  const interactions = await db.query<Record<string, unknown>>(
    `SELECT * FROM interactions WHERE contact_id = ? AND user_id = ? ORDER BY date DESC LIMIT ?`,
    [contactId, userId, limit]
  );

  return c.json({ data: interactions });
});

// GET /api/interactions — global list for the authenticated user
interactionsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env);
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const contactId = c.req.query('contact_id');
  const type = c.req.query('type');
  const since = c.req.query('since');

  let sql = `SELECT i.*, c.full_name as contact_name FROM interactions i LEFT JOIN contacts c ON i.contact_id = c.id WHERE i.user_id = ?`;
  const params: unknown[] = [userId];

  if (contactId) {
    sql += ` AND i.contact_id = ?`;
    params.push(contactId);
  }
  if (type) {
    sql += ` AND i.type = ?`;
    params.push(type);
  }
  if (since) {
    sql += ` AND i.date >= ?`;
    params.push(since);
  }

  sql += ` ORDER BY i.date DESC LIMIT ?`;
  params.push(limit);

  const interactions = await db.query<Record<string, unknown>>(sql, params);
  return c.json({ data: interactions });
});

// PATCH /api/interactions/:id — update an interaction (type, date, notes)
interactionsRouter.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = InteractionSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM interactions WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  if (!existing) {
    return c.json({ error: 'Interaction not found' }, 404);
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  if (parsed.data.type !== undefined) { setClauses.push('type = ?'); values.push(parsed.data.type); }
  if (parsed.data.date !== undefined) { setClauses.push('date = ?'); values.push(parsed.data.date); }
  if (parsed.data.notes !== undefined) { setClauses.push('notes = ?'); values.push(parsed.data.notes || null); }

  if (setClauses.length > 0) {
    values.push(id);
    await db.execute(`UPDATE interactions SET ${setClauses.join(', ')} WHERE id = ?`, values);
  }

  const updated = await db.queryOne<Record<string, unknown>>(
    'SELECT * FROM interactions WHERE id = ?',
    [id]
  );

  return c.json({ data: updated });
});

// DELETE /api/interactions/:id — delete by ID without needing contact_id
interactionsRouter.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const db = createDb(c.env);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM interactions WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  if (!existing) {
    return c.json({ error: 'Interaction not found' }, 404);
  }

  await db.execute('DELETE FROM interactions WHERE id = ? AND user_id = ?', [id, userId]);
  return c.json({ data: { success: true } });
});

// POST /api/contacts/:id/interactions
interactionsRouter.post('/:contactId/interactions', async (c) => {
  const userId = c.get('userId');
  const contactId = c.req.param('contactId');
  const body = await c.req.json().catch(() => null);
  const parsed = InteractionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env);

  // Verify contact belongs to user
  const contact = await db.queryOne<{ id: string }>(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?',
    [contactId, userId]
  );
  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO interactions (id, contact_id, user_id, type, date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, contactId, userId, parsed.data.type, parsed.data.date, parsed.data.notes ?? null, now]
  );

  const interaction = await db.queryOne<Record<string, unknown>>(
    'SELECT * FROM interactions WHERE id = ?',
    [id]
  );

  return c.json({ data: interaction }, 201);
});
