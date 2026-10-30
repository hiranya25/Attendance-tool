// Run by a cPanel cron job every 15 minutes: reads hr@, sends reminders and the HR summary, closes months.
import { runAll } from './jobs.ts';
import { closeDb } from './db.ts';
import { now } from './config.ts';
import { logError } from './log.ts';

runAll((line) => console.log(`[${now()}] ${line}`))
  .catch((e) => { logError('automatic run', e); process.exitCode = 1; })
  .finally(() => closeDb());
