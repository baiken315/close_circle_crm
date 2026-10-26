import type { Database } from '../db.js';

export async function listReminders(
  input: { due_before?: string; completed?: boolean; contact_id?: string },
  db: Database,
  userId: string
) {
  let sql = `
    SELECT r.*, c.full_name as contact_name
    FROM reminders r
    LEFT JOIN contacts c ON r.contact_id = c.id
    WHERE r.user_id = ?
  `;
  const params: unknown[] = [userId];

  if (input.completed !== undefined) {
    sql += ` AND r.completed = ?`;
    params.push(input.completed);
  }

  if (input.contact_id) {
    sql += ` AND r.contact_id = ?`;
    params.push(input.contact_id);
  }

  if (input.due_before) {
    sql += ` AND r.due_date <= ?`;
    params.push(input.due_before);
  }

  sql += ` ORDER BY r.due_date ASC LIMIT 50`;

  return db.query<Record<string, unknown>>(sql, params);
}

export async function createReminder(
  input: {
    title: string;
    notes?: string;
    due_date: string;
    contact_id?: string;
    recurrence_days?: number;
    recurrence_end_date?: string;
  },
  db: Database,
  userId: string
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO reminders (id, contact_id, user_id, title, notes, due_date, completed, recurrence_days, recurrence_end_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, false, ?, ?, ?)`,
    [
      id, input.contact_id ?? null, userId, input.title, input.notes ?? null,
      input.due_date, input.recurrence_days ?? null, input.recurrence_end_date ?? null, now
    ]
  );

  return db.queryOne<Record<string, unknown>>(
    `SELECT r.*, c.full_name as contact_name FROM reminders r LEFT JOIN contacts c ON r.contact_id = c.id WHERE r.id = ?`,
    [id]
  );
}

export async function completeReminder(
  input: { id: string },
  db: Database,
  userId: string
) {
  const reminder = await db.queryOne<{
    id: string;
    contact_id: string | null;
    title: string;
    notes: string | null;
    due_date: string;
    completed: boolean;
    recurrence_days: number | null;
    recurrence_end_date: string | null;
  }>(
    'SELECT * FROM reminders WHERE id = ? AND user_id = ?',
    [input.id, userId]
  );

  if (!reminder) {
    throw new Error(`Reminder ${input.id} not found`);
  }

  const now = new Date().toISOString();
  await db.execute(
    'UPDATE reminders SET completed = true, completed_at = ? WHERE id = ? AND user_id = ?',
    [now, input.id, userId]
  );

  // Handle recurrence
  if (reminder.recurrence_days && !reminder.completed) {
    const nextDue = new Date(reminder.due_date);
    nextDue.setDate(nextDue.getDate() + reminder.recurrence_days);

    const shouldCreate = !reminder.recurrence_end_date ||
      nextDue <= new Date(reminder.recurrence_end_date);

    if (shouldCreate) {
      const nextId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO reminders (id, contact_id, user_id, title, notes, due_date, completed, recurrence_days, recurrence_end_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, false, ?, ?, ?)`,
        [
          nextId, reminder.contact_id, userId, reminder.title, reminder.notes,
          nextDue.toISOString(), reminder.recurrence_days, reminder.recurrence_end_date, now
        ]
      );
    }
  }

  return db.queryOne<Record<string, unknown>>(
    `SELECT r.*, c.full_name as contact_name FROM reminders r LEFT JOIN contacts c ON r.contact_id = c.id WHERE r.id = ?`,
    [input.id]
  );
}
