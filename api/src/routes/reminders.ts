import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db.js';
import type { AppContext } from '../auth.js';
import { safeEqual } from '../auth.js';
import { generateHmac } from './notifications.js';

export const remindersRouter = new Hono<AppContext>();

const ReminderSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  due_date: z.string().datetime({ offset: true }),
  contact_id: z.string().optional().nullable(),
  recurrence_days: z.number().int().positive().optional().nullable(),
  recurrence_annual: z.boolean().optional().nullable(),
  recurrence_end_date: z.string().datetime({ offset: true }).optional().nullable(),
});

// Advance a due date by one year, preserving month/day. Feb 29 rolls to Feb 28
// on non-leap years (avoids the +365-days drift that crosses month boundaries).
function addOneYear(d: Date): Date {
  const next = new Date(d);
  const year = next.getFullYear() + 1;
  let month = next.getMonth();
  let day = next.getDate();
  // Clamp Feb 29 -> Feb 28 when the target year is not a leap year
  if (month === 1 && day === 29 && !((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) {
    day = 28;
  }
  next.setFullYear(year, month, day);
  return next;
}

const ReminderUpdateSchema = ReminderSchema.partial();

// GET /api/reminders
remindersRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env);

  const completedParam = c.req.query('completed');
  const contactId = c.req.query('contact_id');
  const dueBefore = c.req.query('due_before');

  let sql = `
    SELECT r.*, c.full_name as contact_name
    FROM reminders r
    LEFT JOIN contacts c ON r.contact_id = c.id
    WHERE r.user_id = ?
  `;
  const params: unknown[] = [userId];

  if (completedParam !== undefined) {
    sql += ` AND r.completed = ?`;
    params.push(completedParam === 'true');
  }

  if (contactId) {
    sql += ` AND r.contact_id = ?`;
    params.push(contactId);
  }

  if (dueBefore) {
    sql += ` AND r.due_date <= ?`;
    params.push(dueBefore);
  }

  sql += ` ORDER BY r.due_date ASC`;

  const reminders = await db.query<Record<string, unknown>>(sql, params);
  return c.json({ data: reminders });
});

// POST /api/reminders
remindersRouter.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => null);
  const parsed = ReminderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env);
  const { title, notes, due_date, contact_id, recurrence_days, recurrence_annual, recurrence_end_date } = parsed.data;

  if (contact_id) {
    const contact = await db.queryOne<{ id: string }>(
      'SELECT id FROM contacts WHERE id = ? AND user_id = ?',
      [contact_id, userId]
    );
    if (!contact) {
      return c.json({ error: 'Contact not found' }, 404);
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO reminders (id, contact_id, user_id, title, notes, due_date, completed, recurrence_days, recurrence_annual, recurrence_end_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, false, ?, ?, ?, ?)`,
    [id, contact_id ?? null, userId, title, notes ?? null, due_date, recurrence_days ?? null, recurrence_annual ?? null, recurrence_end_date ?? null, now]
  );

  const reminder = await db.queryOne<Record<string, unknown>>(
    `SELECT r.*, c.full_name as contact_name FROM reminders r LEFT JOIN contacts c ON r.contact_id = c.id WHERE r.id = ?`,
    [id]
  );

  return c.json({ data: reminder }, 201);
});

// PATCH /api/reminders/:id
remindersRouter.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const reminderId = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = ReminderUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM reminders WHERE id = ? AND user_id = ?',
    [reminderId, userId]
  );
  if (!existing) {
    return c.json({ error: 'Reminder not found' }, 404);
  }

  const fields = parsed.data;
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (fields.title !== undefined) { setClauses.push('title = ?'); values.push(fields.title); }
  if (fields.notes !== undefined) { setClauses.push('notes = ?'); values.push(fields.notes); }
  if (fields.due_date !== undefined) { setClauses.push('due_date = ?'); values.push(fields.due_date); }
  if (fields.contact_id !== undefined) { setClauses.push('contact_id = ?'); values.push(fields.contact_id); }
  if (fields.recurrence_days !== undefined) { setClauses.push('recurrence_days = ?'); values.push(fields.recurrence_days); }
  if (fields.recurrence_annual !== undefined) { setClauses.push('recurrence_annual = ?'); values.push(fields.recurrence_annual); }
  if (fields.recurrence_end_date !== undefined) { setClauses.push('recurrence_end_date = ?'); values.push(fields.recurrence_end_date); }

  if (setClauses.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  values.push(reminderId, userId);
  await db.execute(
    `UPDATE reminders SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
    values
  );

  const reminder = await db.queryOne<Record<string, unknown>>(
    `SELECT r.*, c.full_name as contact_name FROM reminders r LEFT JOIN contacts c ON r.contact_id = c.id WHERE r.id = ?`,
    [reminderId]
  );
  return c.json({ data: reminder });
});

// DELETE /api/reminders/:id
remindersRouter.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const reminderId = c.req.param('id');
  const db = createDb(c.env);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM reminders WHERE id = ? AND user_id = ?',
    [reminderId, userId]
  );
  if (!existing) {
    return c.json({ error: 'Reminder not found' }, 404);
  }

  await db.execute('DELETE FROM reminders WHERE id = ? AND user_id = ?', [reminderId, userId]);
  return c.json({ data: { success: true } });
});

// POST /api/reminders/:id/complete
// Handles both HMAC-token path (from SW notification) and authenticated path (from UI)
remindersRouter.post('/:id/complete', async (c) => {
  const reminderId = c.req.param('id');
  const db = createDb(c.env);
  const hmacToken = new URL(c.req.url).searchParams.get('token');

  // HMAC path — validate token, derive userId from the reminder record
  if (hmacToken) {
    const reminder = await db.queryOne<{
      id: string; user_id: string; completed: boolean;
      contact_id: string | null; title: string; notes: string | null;
      due_date: string; recurrence_days: number | null; recurrence_annual: boolean | null; recurrence_end_date: string | null;
    }>(
      'SELECT * FROM reminders WHERE id = ?',
      [reminderId]
    );
    if (!reminder) return c.json({ error: 'Reminder not found' }, 404);

    const completionSecret = process.env['COMPLETION_SECRET'] ?? '';
    const expected = await generateHmac(`${reminderId}:${reminder.user_id}`, completionSecret);
    if (!safeEqual(hmacToken, expected)) return c.json({ error: 'Invalid token' }, 403);

    if (reminder.completed) return c.json({ data: { already_completed: true } });

    const now = new Date().toISOString();
    await db.execute('UPDATE reminders SET completed = true, completed_at = ? WHERE id = ?', [now, reminderId]);

    if (reminder.recurrence_annual || reminder.recurrence_days) {
      const base = new Date(reminder.due_date);
      const nextDue = reminder.recurrence_annual
        ? addOneYear(base)
        : (() => { const d = new Date(base); d.setDate(d.getDate() + reminder.recurrence_days!); return d; })();
      const shouldCreate = !reminder.recurrence_end_date || nextDue <= new Date(reminder.recurrence_end_date);
      if (shouldCreate) {
        const nextId = crypto.randomUUID();
        await db.execute(
          `INSERT INTO reminders (id, contact_id, user_id, title, notes, due_date, completed, recurrence_days, recurrence_annual, recurrence_end_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, false, ?, ?, ?, ?)`,
          [nextId, reminder.contact_id, reminder.user_id, reminder.title, reminder.notes,
           nextDue.toISOString(), reminder.recurrence_days, reminder.recurrence_annual, reminder.recurrence_end_date, now]
        );
      }
    }

    return c.json({ data: { success: true } });
  }

  // Authenticated path — userId from JWT
  const userId = c.get('userId');

  const reminder = await db.queryOne<{
    id: string;
    contact_id: string | null;
    user_id: string;
    title: string;
    notes: string | null;
    due_date: string;
    completed: boolean;
    recurrence_days: number | null;
    recurrence_annual: boolean | null;
    recurrence_end_date: string | null;
  }>(
    'SELECT * FROM reminders WHERE id = ? AND user_id = ?',
    [reminderId, userId]
  );

  if (!reminder) {
    return c.json({ error: 'Reminder not found' }, 404);
  }

  const now = new Date().toISOString();
  await db.execute(
    'UPDATE reminders SET completed = true, completed_at = ? WHERE id = ? AND user_id = ?',
    [now, reminderId, userId]
  );

  // Handle recurrence
  if ((reminder.recurrence_annual || reminder.recurrence_days) && !reminder.completed) {
    const base = new Date(reminder.due_date);
    const nextDue = reminder.recurrence_annual
      ? addOneYear(base)
      : (() => { const d = new Date(base); d.setDate(d.getDate() + reminder.recurrence_days!); return d; })();

    // Check if next instance is before recurrence end
    const shouldCreate = !reminder.recurrence_end_date ||
      nextDue <= new Date(reminder.recurrence_end_date);

    if (shouldCreate) {
      const nextId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO reminders (id, contact_id, user_id, title, notes, due_date, completed, recurrence_days, recurrence_annual, recurrence_end_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, false, ?, ?, ?, ?)`,
        [
          nextId, reminder.contact_id, userId, reminder.title, reminder.notes,
          nextDue.toISOString(), reminder.recurrence_days, reminder.recurrence_annual, reminder.recurrence_end_date, now
        ]
      );
    }
  }

  const updated = await db.queryOne<Record<string, unknown>>(
    `SELECT r.*, c.full_name as contact_name FROM reminders r LEFT JOIN contacts c ON r.contact_id = c.id WHERE r.id = ?`,
    [reminderId]
  );

  return c.json({ data: updated });
});
