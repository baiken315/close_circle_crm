import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db.js';
import type { AppContext } from '../auth.js';

export const queryRouter = new Hono<AppContext>();

// Keyword checks are a first line of defense only — the DuckDB connection itself is opened
// with external access disabled and config locked (see db.ts), which is what blocks file reads.
const FORBIDDEN = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE', 'EXEC',
  'ATTACH', 'DETACH', 'COPY', 'INSTALL', 'PRAGMA'];

// Credentials and push tokens are never queryable
const FORBIDDEN_TABLES = ['USERS', 'PASSWORD_HASH', 'DEVICE_TOKENS'];

const QuerySchema = z.object({
  sql: z.string().min(1),
});

// POST /api/query — SELECT-only DuckDB queries, user-scoped
// Callers must include AND user_id = '<user_id>' in WHERE clauses for user-owned tables.
// The authenticated user's ID is returned in the response so callers can construct scoped queries.
queryRouter.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => null);
  const parsed = QuerySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const sql = parsed.data.sql.trim().replace(/;\s*$/, '');

  const trimmed = sql.toUpperCase();
  if (!trimmed.startsWith('SELECT')) {
    return c.json({ error: 'Only SELECT queries are allowed' }, 400);
  }
  if (sql.includes(';')) {
    return c.json({ error: 'Only a single statement is allowed' }, 400);
  }
  for (const kw of FORBIDDEN) {
    if (new RegExp(`\\b${kw}\\b`).test(trimmed)) {
      return c.json({ error: `${kw} statements are not allowed` }, 400);
    }
  }
  for (const table of FORBIDDEN_TABLES) {
    if (new RegExp(`\\b${table}\\b`).test(trimmed)) {
      return c.json({ error: `${table.toLowerCase()} is not queryable` }, 400);
    }
  }

  const db = createDb(c.env);
  try {
    const rawRows = await db.query<Record<string, unknown>>(sql, []);
    // Serialize BigInt values (e.g. from COUNT(*)) as strings to avoid JSON serialization errors
    const rows = JSON.parse(JSON.stringify(rawRows, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
    return c.json({ data: { rows, user_id: userId } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: 'Query failed', detail: message }, 400);
  }
});
