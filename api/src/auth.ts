import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';
import type { Context, Next } from 'hono';
import type { Env } from './db.js';

const BCRYPT_ROUNDS = 10;
const JWT_EXPIRY = '30d';

export function getEnv(): Env {
  return {
    DUCKDB_PATH: process.env['DUCKDB_PATH'] ?? '/data/close_circle.duckdb',
    JWT_SECRET: process.env['JWT_SECRET'] ?? '',
    GOOGLE_SERVICE_ACCOUNT_JSON: process.env['GOOGLE_SERVICE_ACCOUNT_JSON'] ?? '{}',
    FCM_PROJECT_ID: process.env['FCM_PROJECT_ID'] ?? '',
    COMPLETION_SECRET: process.env['COMPLETION_SECRET'] ?? '',
    GROQ_API_KEY: process.env['GROQ_API_KEY'] ?? '',
  };
}

export async function createToken(userId: string, secret: string): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(secretKey);
}

export async function verifyToken(token: string, secret: string): Promise<{ userId: string }> {
  const secretKey = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, secretKey);
  const userId = payload['userId'];
  if (typeof userId !== 'string') {
    throw new Error('Invalid token payload');
  }
  return { userId };
}

// Constant-time string comparison for secrets/tokens
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export type AppContext = {
  Variables: {
    userId: string;
  };
  Bindings: Env;
};

export async function authMiddleware(c: Context<AppContext>, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', code: 'MISSING_TOKEN' }, 401);
  }

  const token = authHeader.slice(7);
  const env = getEnv();
  try {
    const { userId } = await verifyToken(token, env.JWT_SECRET);
    c.set('userId', userId);
    await next();
  } catch {
    return c.json({ error: 'Unauthorized', code: 'INVALID_TOKEN' }, 401);
  }
}
