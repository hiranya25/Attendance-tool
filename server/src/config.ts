import fs from 'node:fs';
import path from 'node:path';

export interface AppConfig {
  appUrl: string;
  timezone: string;
  database: { client: 'pg' | 'mysql2' | 'better-sqlite3'; host?: string; port?: number; user?: string; password?: string; database?: string; filename?: string };
  storageDir: string;
  sessionSecret: string;
  microsoft: { tenantId: string; clientId: string; clientSecret: string; mailbox: string; sender: string };
  anthropic: { apiKey: string; model: string };
  sendEmail: boolean;
}

let cached: AppConfig | null = null;
let baseDir = process.cwd();

/** Reads config.json (next to the app, or the path in ATTENDANCE_CONFIG). Never sent to the browser. */
export function config(): AppConfig {
  if (cached) return cached;
  const file = process.env.ATTENDANCE_CONFIG || path.resolve(process.cwd(), 'config.json');
  if (!fs.existsSync(file)) throw new Error(`config.json is missing (looked for ${file}). Copy config.sample.json to config.json and fill it in.`);
  baseDir = path.dirname(file);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<AppConfig>;
  cached = {
    appUrl: '', timezone: 'Asia/Kolkata', storageDir: './storage', sessionSecret: '', sendEmail: true,
    ...raw,
    database: { client: 'pg', ...raw.database },
    microsoft: { tenantId: '', clientId: '', clientSecret: '', mailbox: 'hr@amipi.com', sender: 'hr@amipi.com', ...raw.microsoft },
    anthropic: { apiKey: '', model: 'claude-opus-5-5', ...raw.anthropic },
  } as AppConfig;
  process.env.TZ = cached.timezone;
  return cached;
}

export function setConfig(c: AppConfig, dir = process.cwd()) {
  cached = c;
  baseDir = dir;
  process.env.TZ = c.timezone;
}

/** A folder inside storageDir, created when missing. Kept outside public_html. */
export function storage(sub = ''): string {
  const root = path.resolve(baseDir, config().storageDir);
  const dir = sub ? path.join(root, sub) : root;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Today in the configured time zone. Tests can pin it with ATTENDANCE_TODAY. */
export function today(): string {
  config();
  return process.env.ATTENDANCE_TODAY || localStamp(new Date()).slice(0, 10);
}

/** "2026-10-29T18:05" in local time. */
export function now(): string {
  config();
  const t = localStamp(new Date());
  return process.env.ATTENDANCE_TODAY ? `${process.env.ATTENDANCE_TODAY}${t.slice(10)}` : t;
}

export function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
