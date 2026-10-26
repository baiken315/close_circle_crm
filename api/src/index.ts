import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppContext } from './auth.js';
import { authMiddleware } from './auth.js';
import { usersRouter } from './routes/users.js';
import { contactsRouter } from './routes/contacts.js';
import { interactionsRouter } from './routes/interactions.js';
import { remindersRouter } from './routes/reminders.js';
import { datesRouter } from './routes/dates.js';
import { chatRouter } from './routes/chat.js';
import { notificationsRouter } from './routes/notifications.js';
import { queryRouter } from './routes/query.js';
import { photosRouter } from './routes/photos.js';
import { createDb, type Env } from './db.js';
import { checkDueReminders } from './cron/reminders.js';
import { checkUpcomingDates } from './cron/dates.js';

const app = new Hono<AppContext>();

// CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Type'],
  maxAge: 86400,
}));

// Auth middleware for all /api routes except public ones
app.use('/api/*', async (c, next) => {
  const url = new URL(c.req.url);
  const path = url.pathname;
  const isCompletionWebhook = /^\/api\/reminders\/[^/]+\/complete$/.test(path) && url.searchParams.has('token');
  const isPublicPhoto = c.req.method === 'GET' && /^\/api\/contacts\/[^/]+\/photo$/.test(path);
  if (path.startsWith('/api/auth/') || path === '/api/health' || isCompletionWebhook || isPublicPhoto) {
    return next();
  }
  return authMiddleware(c, next);
});

// All user routes (auth middleware skips /api/auth/* paths above)
app.route('/api', usersRouter);

// Protected routes
app.route('/api/contacts', contactsRouter);
app.route('/api/contacts', interactionsRouter);
app.route('/api/interactions', interactionsRouter);
app.route('/api/reminders', remindersRouter);
app.route('/api/query', queryRouter);
app.route('/api/dates', datesRouter);
app.route('/api/contacts', photosRouter);
app.route('/api', datesRouter);
app.route('/api/chat', chatRouter);
app.route('/api/device-tokens', notificationsRouter);

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Manual cron trigger (auth-protected, for testing)
app.post('/api/cron/run', async (c) => {
  const env: Env = {
    DUCKDB_PATH: process.env['DUCKDB_PATH'] ?? '/data/close_circle.duckdb',
    JWT_SECRET: process.env['JWT_SECRET'] ?? '',
    COMPLETION_SECRET: process.env['COMPLETION_SECRET'] ?? '',
    GOOGLE_SERVICE_ACCOUNT_JSON: process.env['GOOGLE_SERVICE_ACCOUNT_JSON'] ?? '{}',
    FCM_PROJECT_ID: process.env['FCM_PROJECT_ID'] ?? '',
    GROQ_API_KEY: process.env['GROQ_API_KEY'] ?? '',
  };
  const db = createDb(env);
  console.log(`[cron/manual] triggered at ${new Date().toISOString()}`);
  await Promise.all([checkDueReminders(db, env), checkUpcomingDates(db, env)]);
  return c.json({ ok: true, timestamp: new Date().toISOString() });
});

export default app;
