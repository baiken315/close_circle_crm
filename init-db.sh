#!/bin/bash
# init-db.sh — initialize the DuckDB schema (run once on first deploy)
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

echo "[init-db] applying schema.sql to local DuckDB..."
docker compose run --rm api node --input-type=module <<'EOF'
import { Database } from 'duckdb-async';
import { readFileSync } from 'fs';

const dbPath = process.env['DUCKDB_PATH'] ?? '/data/close_circle.duckdb';
const db = await Database.create(dbPath);
const conn = await db.connect();

const schema = readFileSync('/app/schema.sql', 'utf8');
const statements = schema
  .split(';')
  .map(s => s.replace(/--[^\n]*/g, '').trim())
  .filter(s => s.length > 0);

for (const stmt of statements) {
  try {
    await conn.run(stmt);
  } catch (e) {
    if (!e.message.includes('already exists')) throw e;
  }
}

await conn.close();
await db.close();
console.log('Schema initialized successfully.');
EOF

echo "[init-db] done."
