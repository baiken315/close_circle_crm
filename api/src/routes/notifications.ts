import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db.js';
import type { AppContext } from '../auth.js';
import { safeEqual } from '../auth.js';

export const notificationsRouter = new Hono<AppContext>();

const DeviceTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['web', 'android', 'ios']).default('web'),
});

// PUT /api/device-tokens
notificationsRouter.put('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => null);
  const parsed = DeviceTokenSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env);
  const { token, platform } = parsed.data;
  const now = new Date().toISOString();

  // Check if token already exists
  const existing = await db.queryOne<{ id: string; user_id: string }>(
    'SELECT id, user_id FROM device_tokens WHERE token = ?',
    [token]
  );

  if (existing) {
    await db.execute(
      'UPDATE device_tokens SET user_id = ?, platform = ?, last_seen = ? WHERE token = ?',
      [userId, platform, now, token]
    );
    return c.json({ data: { id: existing.id, token, platform, updated: true } });
  }

  const id = crypto.randomUUID();
  await db.execute(
    'INSERT INTO device_tokens (id, user_id, token, platform, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)',
    [id, userId, token, platform, now, now]
  );

  return c.json({ data: { id, token, platform, updated: false } }, 201);
});

// DELETE /api/device-tokens/:id
notificationsRouter.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const tokenId = c.req.param('id');
  const db = createDb(c.env);

  const token = await db.queryOne<{ id: string }>(
    'SELECT id FROM device_tokens WHERE id = ? AND user_id = ?',
    [tokenId, userId]
  );

  if (!token) {
    return c.json({ error: 'Token not found' }, 404);
  }

  await db.execute('DELETE FROM device_tokens WHERE id = ?', [tokenId]);
  return c.json({ data: { success: true } });
});

// POST /api/reminders/:id/complete?token=... (HMAC-protected, no auth header needed)
export async function handleCompletionWebhook(c: { req: Request; env: AppContext['Bindings'] }): Promise<Response> {
  const url = new URL(c.req.url);
  const token = url.searchParams.get('token');
  const pathParts = url.pathname.split('/');
  const reminderId = pathParts[pathParts.indexOf('reminders') + 1] ?? '';

  if (!token || !reminderId) {
    return Response.json({ error: 'Missing token or reminder ID' }, { status: 400 });
  }

  // Validate HMAC
  const COMPLETION_SECRET = process.env['COMPLETION_SECRET'] ?? '';
  const db = (await import('../db.js')).createDb();

  const reminder = await db.queryOne<{ id: string; user_id: string; completed: boolean }>(
    'SELECT id, user_id, completed FROM reminders WHERE id = ?',
    [reminderId]
  );

  if (!reminder) {
    return Response.json({ error: 'Reminder not found' }, { status: 404 });
  }

  const expectedToken = await generateHmac(`${reminderId}:${reminder.user_id}`, COMPLETION_SECRET);
  if (!safeEqual(token, expectedToken)) {
    return Response.json({ error: 'Invalid token' }, { status: 403 });
  }

  if (reminder.completed) {
    return Response.json({ data: { already_completed: true } });
  }

  const now = new Date().toISOString();
  await db.execute(
    'UPDATE reminders SET completed = true, completed_at = ? WHERE id = ?',
    [now, reminderId]
  );

  return Response.json({ data: { success: true } });
}

export async function generateHmac(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
