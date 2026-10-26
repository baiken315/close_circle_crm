import 'dotenv/config';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { serve } from '@hono/node-server';
import cron from 'node-cron';
import app from './index.js';
import { createDb, type Env } from './db.js';
import { checkDueReminders } from './cron/reminders.js';
import { checkUpcomingDates } from './cron/dates.js';

const PORT = parseInt(process.env['PORT'] ?? '8787', 10);

const env: Env = {
  DUCKDB_PATH: process.env['DUCKDB_PATH'] ?? '/data/close_circle.duckdb',
  JWT_SECRET: process.env['JWT_SECRET'] ?? '',
  COMPLETION_SECRET: process.env['COMPLETION_SECRET'] ?? '',
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env['GOOGLE_SERVICE_ACCOUNT_JSON'] ?? '',
  FCM_PROJECT_ID: process.env['FCM_PROJECT_ID'] ?? '',
  GROQ_API_KEY: process.env['GROQ_API_KEY'] ?? '',
};

// Refuse to start with missing/weak secrets — an empty JWT_SECRET or COMPLETION_SECRET
// would make tokens trivially forgeable.
for (const key of ['JWT_SECRET', 'COMPLETION_SECRET'] as const) {
  if (env[key].length < 32) {
    console.error(`[startup] ${key} must be set to at least 32 characters, refusing to start`);
    process.exit(1);
  }
}

// Runs pending SQL migrations from /migrations before the HTTP server starts.
// Uses the same singleton DuckDB connection as the app — no file-lock conflict.
async function runMigrations(): Promise<void> {
  const db = createDb(env);
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // Compiled to dist/server.js; migrations are at /app/migrations (one level up from dist/)
  const migrationsDir = join(__dirname, '../migrations');

  // Fresh database: schema.sql is the canonical, up-to-date schema, so apply it directly
  // and record every migration as applied (the migrations only upgrade older databases).
  const existing = await db.queryOne<{ n: number }>(
    `SELECT count(*)::INTEGER AS n FROM information_schema.tables WHERE table_name = 'users'`
  );
  const isFreshDb = (existing?.n ?? 0) === 0;
  if (isFreshDb) {
    console.log('[migration] fresh database, applying schema.sql ...');
    const schema = await readFile(join(__dirname, '../schema.sql'), 'utf8');
    const schemaStatements = schema
      .split(';')
      .map(s => s.replace(/--[^\n]*/g, '').trim())
      .filter(s => s.length > 0);
    for (const stmt of schemaStatements) {
      await db.execute(stmt);
    }
  }

  await db.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  if (isFreshDb) {
    for (const file of (await readdir(migrationsDir)).filter(f => f.endsWith('.sql'))) {
      await db.execute('INSERT INTO schema_migrations (version) VALUES (?) ON CONFLICT DO NOTHING', [file]);
    }
  }

  const applied = new Set(
    (await db.query<{ version: string }>('SELECT version FROM schema_migrations')).map(r => r.version)
  );

  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }
    console.log(`[migration] applying ${file} ...`);
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    const statements = sql
      .split(';')
      .map(s => s.replace(/--[^\n]*/g, '').trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      await db.execute(stmt);
    }
    await db.execute('INSERT INTO schema_migrations (version) VALUES (?)', [file]);
    console.log(`[migration] applied ${file}`);
  }

  // Flush WAL to main database file so a container restart never replays stale DDL
  await db.execute('CHECKPOINT');
  console.log('[migration] WAL checkpointed');
}

runMigrations()
  .then(() => {
    serve({ fetch: app.fetch, port: PORT }, (info) => {
      console.log(`Close Circle API running at http://localhost:${info.port}`);
    });

    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.log(`[cron] checking reminders and dates at ${new Date().toISOString()}`);
      const db = createDb(env);
      try {
        await Promise.all([
          checkDueReminders(db, env),
          checkUpcomingDates(db, env),
        ]);
        console.log('[cron] done');
      } catch (err) {
        console.error('[cron] error:', err);
      }
    });
  })
  .catch(err => {
    console.error('[startup] migration failed, refusing to start:', err);
    process.exit(1);
  });
