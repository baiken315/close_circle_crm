import { Database as DuckDB } from 'duckdb-async';

export interface Env {
  DUCKDB_PATH: string;
  JWT_SECRET: string;
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  FCM_PROJECT_ID: string;
  COMPLETION_SECRET: string;
  GROQ_API_KEY: string;
}

// Singleton connection — reuse across requests within the same process
let _db: DuckDB | null = null;
let _dbPath: string | null = null;

async function getConnection(dbPath: string): Promise<DuckDB> {
  if (_db && _dbPath === dbPath) {
    return _db;
  }
  if (_db) {
    try { await _db.close(); } catch { /* ignore */ }
  }
  // Lock DuckDB to the main database file: no read_text()/read_csv() on host files,
  // no COPY TO, ATTACH, or extension installs, and no SET to undo it at runtime.
  _db = await DuckDB.create(dbPath, {
    enable_external_access: 'false',
    autoinstall_known_extensions: 'false',
    autoload_known_extensions: 'false',
    lock_configuration: 'true',
  });
  _dbPath = dbPath;
  return _db;
}

export class Database {
  constructor(private dbPath: string = '/data/close_circle.duckdb') {}

  private async conn(): Promise<DuckDB> {
    return getConnection(this.dbPath);
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = await this.conn();
    const conn = await db.connect();
    try {
      const rows = params.length > 0
        ? await conn.all(sql, ...params)
        : await conn.all(sql);
      return rows as T[];
    } finally {
      await conn.close();
    }
  }

  async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const db = await this.conn();
    const conn = await db.connect();
    try {
      if (params.length > 0) {
        await conn.run(sql, ...params);
      } else {
        await conn.run(sql);
      }
    } finally {
      await conn.close();
    }
  }

  async executeMany(statements: { sql: string; params?: unknown[] }[]): Promise<void> {
    for (const { sql, params } of statements) {
      await this.execute(sql, params ?? []);
    }
  }

}

// Module-level singleton database instance
let _database: Database | null = null;

export function createDb(_env?: Partial<Env>): Database {
  const dbPath = process.env['DUCKDB_PATH'] ?? '/data/close_circle.duckdb';
  if (!_database || _dbPath !== dbPath) {
    _database = new Database(dbPath);
  }
  return _database;
}
