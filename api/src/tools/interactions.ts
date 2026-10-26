import type { Database } from '../db.js';

export async function listInteractions(
  input: { contact_id: string; limit?: number },
  db: Database,
  userId: string
) {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM interactions WHERE contact_id = ? AND user_id = ? ORDER BY date DESC LIMIT ?`,
    [input.contact_id, userId, input.limit ?? 20]
  );
}

export async function logInteraction(
  input: {
    contact_id: string;
    type: string;
    date: string;
    notes?: string;
  },
  db: Database,
  userId: string
) {
  // Verify contact belongs to user
  const contact = await db.queryOne<{ id: string; full_name: string }>(
    'SELECT id, full_name FROM contacts WHERE id = ? AND user_id = ?',
    [input.contact_id, userId]
  );
  if (!contact) {
    throw new Error(`Contact ${input.contact_id} not found`);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO interactions (id, contact_id, user_id, type, date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.contact_id, userId, input.type, input.date, input.notes ?? null, now]
  );

  const interaction = await db.queryOne<Record<string, unknown>>(
    'SELECT * FROM interactions WHERE id = ?',
    [id]
  );

  return { ...interaction, contact_name: contact.full_name };
}
