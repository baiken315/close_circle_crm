import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db.js';
import { createToken, hashPassword, verifyPassword, safeEqual } from '../auth.js';
import type { AppContext } from '../auth.js';

export const usersRouter = new Hono<AppContext>();

// In-memory login throttle, keyed by email (requests all arrive via the same proxy IP)
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const loginFailures = new Map<string, { count: number; resetAt: number }>();

function isLoginThrottled(key: string): boolean {
  const entry = loginFailures.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    loginFailures.delete(key);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILURES;
}

function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || now > entry.resetAt) {
    loginFailures.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count++;
  }
}

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const PreferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).optional(),
  accent_color: z.string().optional(),
  font_family: z.string().optional(),
  layout: z.enum(['compact', 'default', 'cozy']).optional(),
  custom_css: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
});

// POST /api/auth/login
usersRouter.post('/auth/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env);
  const { email, password } = parsed.data;
  const throttleKey = email.toLowerCase();

  if (isLoginThrottled(throttleKey)) {
    return c.json({ error: 'Too many failed attempts. Try again in 15 minutes.', code: 'RATE_LIMITED' }, 429);
  }

  const user = await db.queryOne<{
    id: string;
    email: string;
    name: string;
    password_hash: string;
  }>('SELECT id, email, name, password_hash FROM users WHERE email = ?', [email]);

  if (!user) {
    recordLoginFailure(throttleKey);
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    recordLoginFailure(throttleKey);
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  loginFailures.delete(throttleKey);
  const token = await createToken(user.id, process.env['JWT_SECRET'] ?? '');

  // Upsert default preferences if needed
  await db.execute(
    `INSERT INTO user_preferences (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING`,
    [user.id]
  );

  const prefs = await db.queryOne<{
    theme: string;
    accent_color: string;
    font_family: string;
    layout: string;
    custom_css: string | null;
    settings: string | null;
  }>('SELECT * FROM user_preferences WHERE user_id = ?', [user.id]);

  return c.json({
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name },
      preferences: prefs,
    },
  });
});

// POST /api/auth/logout
usersRouter.post('/auth/logout', async (c) => {
  return c.json({ data: { success: true } });
});

// GET /api/users/me
usersRouter.get('/users/me', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env);

  const user = await db.queryOne<{ id: string; email: string; name: string; created_at: string }>(
    'SELECT id, email, name, created_at FROM users WHERE id = ?',
    [userId]
  );

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const prefs = await db.queryOne<Record<string, unknown>>(
    'SELECT * FROM user_preferences WHERE user_id = ?',
    [userId]
  );

  return c.json({ data: { ...user, preferences: prefs } });
});

// PATCH /api/users/me/preferences
usersRouter.patch('/users/me/preferences', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => null);
  const parsed = PreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env);
  const updates = parsed.data;

  // Build update query dynamically
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.theme !== undefined) { fields.push('theme = ?'); values.push(updates.theme); }
  if (updates.accent_color !== undefined) { fields.push('accent_color = ?'); values.push(updates.accent_color); }
  if (updates.font_family !== undefined) { fields.push('font_family = ?'); values.push(updates.font_family); }
  if (updates.layout !== undefined) { fields.push('layout = ?'); values.push(updates.layout); }
  if (updates.custom_css !== undefined) { fields.push('custom_css = ?'); values.push(updates.custom_css); }
  if (updates.settings !== undefined) { fields.push('settings = ?'); values.push(JSON.stringify(updates.settings)); }

  if (fields.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  values.push(userId);

  await db.execute(
    `INSERT INTO user_preferences (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  await db.execute(
    `UPDATE user_preferences SET ${fields.join(', ')} WHERE user_id = ?`,
    values
  );

  const prefs = await db.queryOne<Record<string, unknown>>(
    'SELECT * FROM user_preferences WHERE user_id = ?',
    [userId]
  );

  return c.json({ data: prefs });
});

// POST /api/auth/register (for first-time setup)
usersRouter.post('/auth/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env);
  const { email, password, name } = parsed.data;

  // Registration is closed once the first account exists, unless explicitly opened
  if (process.env['ALLOW_REGISTRATION'] !== 'true') {
    const anyUser = await db.queryOne<{ id: string }>('SELECT id FROM users LIMIT 1');
    if (anyUser) {
      return c.json({ error: 'Registration is disabled', code: 'REGISTRATION_DISABLED' }, 403);
    }
  }

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );
  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const id = crypto.randomUUID();
  const password_hash = await hashPassword(password);

  await db.execute(
    'INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)',
    [id, email, name, password_hash]
  );

  await db.execute(
    'INSERT INTO user_preferences (user_id) VALUES (?)',
    [id]
  );

  const token = await createToken(id, process.env['JWT_SECRET'] ?? '');

  return c.json({ data: { token, user: { id, email, name } } }, 201);
});

// PATCH /api/users/me/password
usersRouter.patch('/users/me/password', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    current_password: z.string().min(1),
    new_password: z.string().min(8),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env);
  const { current_password, new_password } = parsed.data;

  const user = await db.queryOne<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = ?',
    [userId]
  );

  if (!user) {
    return c.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, 404);
  }

  const valid = await verifyPassword(current_password, user.password_hash);
  if (!valid) {
    return c.json({ error: 'Current password is incorrect' }, 401);
  }

  const new_hash = await hashPassword(new_password);

  await db.execute(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [new_hash, userId]
  );

  return c.json({ data: { success: true } });
});

// POST /api/auth/forgot-password (server-side token, no auth required)
// Flow: 1) Admin creates token file on server, 2) User submits new password + token
usersRouter.post("/auth/forgot-password", async (c) => {
  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    email: z.string().email(),
    token: z.string().min(1),
    new_password: z.string().min(8),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request body", details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env);
  const { email, token, new_password } = parsed.data;

  const fs = await import("fs");
  const path = await import("path");
  const duckdbPath = c.env.DUCKDB_PATH || "/data/close_circle.duckdb";
  const tokenPath = path.default.join(path.default.dirname(duckdbPath), ".password-reset-token");

  let tokenFile: string | null = null;
  try {
    tokenFile = fs.readFileSync(tokenPath, "utf-8").trim();
  } catch {
    return c.json({ error: "No reset token found. Create one via SSH first (see instructions on login page)." }, 403);
  }

  if (!safeEqual(tokenFile, token)) {
    return c.json({ error: "Invalid reset token" }, 403);
  }

  // Delete the token so it can only be used once
  fs.unlinkSync(tokenPath);

  const user = await db.queryOne<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = ?",
    [email]
  );

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const new_hash = await hashPassword(new_password);
  await db.execute("UPDATE users SET password_hash = ? WHERE id = ?", [new_hash, user.id]);

  return c.json({ data: { success: true } });
});
