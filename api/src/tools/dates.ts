import type { Database } from '../db.js';

export async function listImportantDates(
  input: { contact_id?: string },
  db: Database,
  userId: string
) {
  let sql = `
    SELECT d.*, c.full_name as contact_name
    FROM important_dates d
    JOIN contacts c ON d.contact_id = c.id
    WHERE d.user_id = ?
  `;
  const params: unknown[] = [userId];

  if (input.contact_id) {
    sql += ` AND d.contact_id = ?`;
    params.push(input.contact_id);
  }

  sql += ` ORDER BY extract(month FROM d.date), extract(day FROM d.date) ASC`;

  const dates = await db.query<Record<string, unknown>>(sql, params);

  // Add days_until — DuckDB returns DATE columns as JS Date objects
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
    const daysUntil = Math.round((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const dateISO = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(dateObj.getUTCDate()).padStart(2, '0')}`;
    return { ...d, date: dateISO, days_until: daysUntil };
  });
  return enriched.sort((a, b) => a.days_until - b.days_until);
}

export async function addImportantDate(
  input: {
    contact_id: string;
    title: string;
    date: string; // YYYY-MM-DD
    notes?: string;
  },
  db: Database,
  userId: string
) {
  const contact = await db.queryOne<{ id: string; full_name: string }>(
    'SELECT id, full_name FROM contacts WHERE id = ? AND user_id = ?',
    [input.contact_id, userId]
  );
  if (!contact) {
    throw new Error(`Contact ${input.contact_id} not found`);
  }

  const id = crypto.randomUUID();

  await db.execute(
    `INSERT INTO important_dates (id, contact_id, user_id, title, date, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.contact_id, userId, input.title, input.date, input.notes ?? null]
  );

  const date = await db.queryOne<Record<string, unknown>>(
    'SELECT * FROM important_dates WHERE id = ?',
    [id]
  );

  return { ...date, contact_name: contact.full_name };
}
