// Error log: storage/logs/error.log. Kept to about 5 MB; the previous file is kept as error.log.1.
import fs from 'node:fs';
import path from 'node:path';
import { now, storage } from './config.ts';

const MAX_BYTES = 5 * 1024 * 1024;

export function logError(where: string, err: unknown) {
  const text = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
  console.error(`[${where}]`, text);
  try {
    const file = path.join(storage('logs'), 'error.log');
    if (fs.existsSync(file) && fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, `${file}.1`);
    fs.appendFileSync(file, `[${now()}] ${where}: ${text.trim()}\n\n`);
  } catch {
    // Logging must never break the app.
  }
}
