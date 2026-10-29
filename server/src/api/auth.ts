// Sign-in with a session cookie. Two roles: admin (can change rules, people, uploads and users) and viewer (read only).
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { User } from '../../../shared/types.ts';
import { config, localStamp, now } from '../config.ts';
import { db, insertId } from '../db.ts';

const COOKIE = 'attendance_desk';
const DAYS = 14;

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function checkPassword(password: string, stored: string): boolean {
  const [kind, salt, key] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(actual, expected);
}

function readCookie(req: Request): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

function setCookie(res: Response, value: string, maxAge: number) {
  const secure = config().appUrl.startsWith('https://') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

export async function currentUser(req: Request): Promise<User | null> {
  const token = readCookie(req);
  if (!token) return null;
  const k = await db();
  const s = await k('sessions').where({ token: sha(token) }).first();
  if (!s || s.expires_at < now()) return null;
  const u = await k('users').where({ id: s.user_id }).first();
  return u ? { id: Number(u.id), email: u.email, name: u.name, role: u.role } : null;
}

export async function signIn(res: Response, email: string, password: string): Promise<User> {
  const k = await db();
  const u = await k('users').where({ email: email.trim().toLowerCase() }).first();
  if (!u || !checkPassword(password, u.pass_hash)) {
    await new Promise((r) => setTimeout(r, 600));
    throw new HttpError(401, 'That email and password do not match.');
  }
  const token = crypto.randomBytes(32).toString('base64url');
  await k('sessions').where('expires_at', '<', now()).delete();
  await k('sessions').insert({ token: sha(token), user_id: u.id, expires_at: localStamp(new Date(Date.now() + DAYS * 86400_000)) });
  setCookie(res, token, DAYS * 86400);
  return { id: Number(u.id), email: u.email, name: u.name, role: u.role };
}

export async function signOut(req: Request, res: Response) {
  const token = readCookie(req);
  if (token) await (await db())('sessions').where({ token: sha(token) }).delete();
  setCookie(res, '', 0);
}

export async function needsSetup(): Promise<boolean> {
  const row = await (await db())('users').count({ n: '*' }).first();
  return Number(row?.n ?? 0) === 0;
}

export async function createUser(name: string, email: string, password: string, role: string): Promise<number> {
  email = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  if (String(password ?? '').length < 10) throw new HttpError(400, 'Use a password of at least 10 characters.');
  if (!String(name ?? '').trim()) throw new HttpError(400, 'Enter a name.');
  const k = await db();
  if (await k('users').where({ email }).first()) throw new HttpError(400, 'Someone with that email already has an account.');
  return insertId(k, 'users', { email, name: name.trim(), pass_hash: hashPassword(password), role: role === 'admin' ? 'admin' : 'viewer', created_at: now() });
}

/** Route guards. Changes also need the X-Requested-With header, which a form on another site cannot send. */
export function requireUser(admin = false) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.method !== 'GET' && req.get('X-Requested-With') !== 'AttendanceDesk') throw new HttpError(403, 'Request blocked.');
      const user = await currentUser(req);
      if (!user) throw new HttpError(401, 'Please sign in.');
      if (admin && user.role !== 'admin') throw new HttpError(403, 'Only an admin can do this.');
      res.locals.user = user;
      next();
    } catch (e) {
      next(e);
    }
  };
}

function sha(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}
