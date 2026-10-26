import type { Database } from '../db.js';

export async function getUserContext(_input: Record<string, never>, db: Database, userId: string) {
  const user = await db.queryOne<{ id: string; email: string; name: string }>(
    'SELECT id, email, name FROM users WHERE id = ?',
    [userId]
  );

  const today = new Date();
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const upcomingReminders = await db.query<Record<string, unknown>>(
    `SELECT r.*, c.full_name as contact_name
     FROM reminders r
     LEFT JOIN contacts c ON r.contact_id = c.id
     WHERE r.user_id = ? AND r.completed = false AND r.due_date <= ?
     ORDER BY r.due_date ASC
     LIMIT 10`,
    [userId, in7Days]
  );

  // Get upcoming important dates in the next 30 days
  const allDates = await db.query<Record<string, unknown>>(
    `SELECT d.*, c.full_name as contact_name
     FROM important_dates d
     JOIN contacts c ON d.contact_id = c.id
     WHERE d.user_id = ?
     ORDER BY extract(month FROM d.date), extract(day FROM d.date) ASC`,
    [userId]
  );

  // Compare against local midnight so a date falling today isn't rolled to next year
  const midnight = new Date(today);
  midnight.setHours(0, 0, 0, 0);
  const upcomingDates = allDates
    .map((d) => {
      const raw = d['date'];
      const dateObj = raw instanceof Date ? raw : new Date(raw as string);
      const month = dateObj.getUTCMonth();
      const day = dateObj.getUTCDate();
      const thisYear = new Date(midnight.getFullYear(), month, day);
      if (thisYear < midnight) {
        thisYear.setFullYear(midnight.getFullYear() + 1);
      }
      const daysUntil = Math.round((thisYear.getTime() - midnight.getTime()) / (1000 * 60 * 60 * 24));
      const dateISO = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(dateObj.getUTCDate()).padStart(2, '0')}`;
      return { ...d, date: dateISO, days_until: daysUntil };
    })
    .filter((d) => d.days_until <= 30)
    .sort((a, b) => a.days_until - b.days_until);

  const overdueReminders = await db.query<Record<string, unknown>>(
    `SELECT r.*, c.full_name as contact_name
     FROM reminders r
     LEFT JOIN contacts c ON r.contact_id = c.id
     WHERE r.user_id = ? AND r.completed = false AND r.due_date < ?
     ORDER BY r.due_date ASC
     LIMIT 5`,
    [userId, today.toISOString()]
  );

  return {
    user,
    today: today.toISOString().split('T')[0],
    upcoming_reminders: upcomingReminders,
    overdue_reminders: overdueReminders,
    upcoming_dates: upcomingDates,
  };
}
