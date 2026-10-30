import fs from 'node:fs';
import express, { type NextFunction, type Request, type Response, Router } from 'express';
import type { Connections, Employee, Holiday, Reference, Settings, Shift, TrendPoint, User } from '../../../shared/types.ts';
import { config, now, today } from '../config.ts';
import { db } from '../db.ts';
import * as R from '../repo.ts';
import * as D from '../engine/dates.ts';
import { buildMonth } from '../engine/monthBuilder.ts';
import { importPunchFile } from '../import/importer.ts';
import { writeWorkbook, type ExcelPart } from '../reports/excel.ts';
import { isUnexplained, totals } from '../reports/summary.ts';
import { buildPackage, runAll } from '../jobs.ts';
import { graphConfigured } from '../mail/graph.ts';
import { aiConfigured, aiName } from '../ai/emailReader.ts';
import { logError } from '../log.ts';
import { changeOwnPassword, createUser, currentUser, HttpError, needsSetup, PASSWORD_RULE, requireUser, resetPassword, signIn, signOut } from './auth.ts';

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).then((out) => { if (!res.headersSent) res.json(out ?? { ok: true }); }).catch(next);
const who = (res: Response) => (res.locals.user as User).name;
const MONTH = /^\d{4}-\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function apiRouter(): Router {
  const api = Router();
  api.use(express.json({ limit: '1mb' }));
  const user = requireUser();
  const admin = requireUser(true);

  // For uptime checks: no sign-in needed, and it shows nothing private.
  api.get('/health', h(async (_req, res) => {
    let database = 'ok';
    try { await (await db()).raw('select 1'); } catch (e) { database = 'not reachable'; logError('health', e); }
    const last = await R.getState('last_run').catch(() => null);
    res.status(database === 'ok' ? 200 : 503);
    return { ok: database === 'ok', database, lastAutomaticRun: last ? (JSON.parse(last) as { at: string }).at : null, time: now() };
  }));

  // Sign-in
  api.get('/session', h(async (req) => ({ user: await currentUser(req), needsSetup: await needsSetup(), passwordRule: PASSWORD_RULE })));
  api.put('/me/password', user, h(async (req, res) => {
    await changeOwnPassword(req, res.locals.user as User, req.body?.current, req.body?.password);
  }));
  api.post('/setup', h(async (req, res) => {
    if (req.get('X-Requested-With') !== 'AttendanceDesk') throw new HttpError(403, 'Request blocked.');
    if (!(await needsSetup())) throw new HttpError(400, 'Setup is already done. Sign in instead.');
    const { name, email, password } = req.body ?? {};
    await createUser(name, email, password, 'admin');
    return { user: await signIn(res, email, password, req.ip) };
  }));
  api.post('/login', h(async (req, res) => {
    if (req.get('X-Requested-With') !== 'AttendanceDesk') throw new HttpError(403, 'Request blocked.');
    return { user: await signIn(res, String(req.body?.email ?? ''), String(req.body?.password ?? ''), req.ip) };
  }));
  api.post('/logout', h(async (req, res) => { await signOut(req, res); }));

  // Reading
  api.get('/reference', user, h(async (_req, res): Promise<Reference> => {
    const [offices, employees, holidays, calendars, shifts, settings, months] = await Promise.all([
      R.getOffices(), R.getEmployees(), R.getHolidays(), R.getCalendars(), R.getShifts(), R.getRules(), R.getMonths(),
    ]);
    const latest = await (await db())('imports').max({ m: 'month' }).first();
    return { offices, employees, holidays, calendars, shifts, settings, months, latestDataMonth: latest?.m ?? null, today: today(), user: res.locals.user };
  }));
  api.get('/months/:month', user, h(async (req) => buildMonth(month(req))));
  api.get('/trend', user, h(async (): Promise<TrendPoint[]> => {
    const out: TrendPoint[] = [];
    for (const m of await R.getMonths()) {
      if (!(await R.latestImport(m))) continue;
      const d = await buildMonth(m);
      out.push({
        month: m,
        issues: d.issues.filter((x) => x.state !== 'system').length,
        unexplained: d.issues.filter(isUnexplained).length,
        lates: d.issues.filter((x) => x.type === 'Late arrival' && x.state !== 'explained').length,
        presentRate: totals(Object.values(d.records).flatMap((r) => Object.values(r))).rate,
      });
    }
    return out;
  }));
  api.get('/months/:month/export', user, h(async (req, res) => {
    const m = month(req);
    const part = (['all', 'master', 'issues'].includes(String(req.query.part)) ? req.query.part : 'all') as ExcelPart;
    const buf = await writeWorkbook(await buildMonth(m), await R.getEmployees(), await R.getOffices(), part);
    sendFile(res, buf, `Attendance-${m}${part === 'all' ? '' : `-${part}`}.xlsx`);
  }));
  api.get('/reports/:id/download', user, h(async (req, res) => {
    const rp = await (await db())('reports').where({ id: Number(req.params.id) }).first();
    if (!rp || !fs.existsSync(rp.path)) throw new HttpError(404, 'That report file is no longer on the server.');
    sendFile(res, fs.readFileSync(rp.path), `Attendance-${rp.month}-v${rp.version}.xlsx`);
  }));
  api.get('/imports', user, h(async () => (await (await db())('imports').orderBy('id', 'desc').limit(100)).map((i) => ({
    id: Number(i.id), month: i.month, fileName: i.file_name, source: i.source, importedAt: i.imported_at, importedBy: i.imported_by, people: Number(i.people), days: Number(i.days),
  }))));
  api.get('/notifications/:id', user, h(async (req) => {
    const n = await (await db())('notifications').where({ id: Number(String(req.params.id).replace(/^N/, '')) }).first();
    if (!n) throw new HttpError(404, 'That message is not on record.');
    return { subject: n.subject, to: n.to_addr, at: n.at, sent: Boolean(Number(n.sent)), error: n.error || null, html: n.body };
  }));
  api.get('/connections', user, h(async (): Promise<Connections> => {
    const last = await R.getState('last_run');
    const parsed = last ? (JSON.parse(last) as { at: string; lines: string[] }) : null;
    return { microsoft: graphConfigured(), ai: aiConfigured(), aiName: aiName(), sendEmail: config().sendEmail, mailbox: config().microsoft.mailbox, lastRun: parsed?.at ?? null, lastRunLog: parsed?.lines ?? [] };
  }));

  // Changing (admin)
  api.post('/imports', admin, express.raw({ type: 'application/octet-stream', limit: '25mb' }), h(async (req, res) => {
    const name = decodeURIComponent(req.get('X-File-Name') ?? 'upload.xls');
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'Choose a file to upload.');
    if (!/\.xlsx?$/i.test(name)) throw new HttpError(400, 'Upload the .xls or .xlsx file exported from the punch system.');
    try {
      return await importPunchFile(req.body, name, 'upload', who(res));
    } catch (e) {
      throw new HttpError(400, `This file could not be read. Upload the "Month Date Wise Performance" export from the punch system. (${(e as Error).message})`);
    }
  }));
  api.put('/settings', admin, h(async (req, res) => {
    const before = await R.getRules();
    const next = cleanSettings({ ...before, ...(req.body as Partial<Settings>) });
    await R.saveRules(next);
    for (const line of describeSettings(before, next)) await R.audit(who(res), 'Rules and settings', line.from, line.to, 'Changed on the Rules page. Every month is checked again with the new value.', 'Settings');
  }));
  api.put('/shifts', admin, h(async (req, res) => {
    const list = req.body as Shift[];
    if (!Array.isArray(list)) throw new HttpError(400, 'Expected a list of shifts.');
    const k = await db();
    for (const s of list) {
      const start = Number(s.start), end = Number(s.end);
      if (!s.code || !(start >= 0 && start < 1440 && end >= 0 && end < 1440)) throw new HttpError(400, `Check the times for shift ${s.code}.`);
      const old = await k('shifts').where({ code: s.code }).first();
      const row = { name: String(s.name ?? '').slice(0, 120), start_min: start, end_min: end, confirmed: s.confirmed ? 1 : 0 };
      if (old) {
        if (old.start_min !== start || old.end_min !== end || Boolean(old.confirmed) !== Boolean(s.confirmed)) {
          await R.audit(who(res), `Shift ${s.code}`, `${D.hm(old.start_min)}–${D.hm(old.end_min)}${old.confirmed ? ' (confirmed)' : ''}`, `${D.hm(start)}–${D.hm(end)}${s.confirmed ? ' (confirmed)' : ''}`, 'Changed on the Rules page.', 'Settings');
        }
        await k('shifts').where({ code: s.code }).update(row);
      } else {
        await k('shifts').insert({ code: String(s.code).slice(0, 16), ...row });
      }
    }
  }));
  api.put('/holidays', admin, h(async (req, res) => {
    const list = req.body as Holiday[];
    if (!Array.isArray(list) || list.some((x) => !DATE.test(x.date) || !x.name?.trim() || !x.calendar)) throw new HttpError(400, 'Each holiday needs a date, a name and a calendar.');
    const k = await db();
    const before = await R.getHolidays();
    const key = (x: Holiday) => `${x.calendar}|${x.date}|${x.name}`;
    const was = new Set(before.map(key));
    const now_ = new Set(list.map(key));
    await k.transaction(async (trx) => {
      await trx('holidays').delete();
      if (list.length) await trx('holidays').insert(list.map((x) => ({ calendar_id: x.calendar, date: x.date, name: x.name.trim().slice(0, 120) })));
    });
    for (const x of list) if (!was.has(key(x))) await R.audit(who(res), 'Holiday calendar', '', `Added ${x.name} (${x.date}, ${x.calendar})`, 'Added on the Rules page.', 'Settings');
    for (const x of before) if (!now_.has(key(x))) await R.audit(who(res), 'Holiday calendar', `${x.name} (${x.date}, ${x.calendar})`, 'Removed', 'Removed on the Rules page.', 'Settings');
  }));
  api.put('/employees/:code', admin, h(async (req, res) => {
    const k = await db();
    const code = String(req.params.code);
    const old = await k('employees').where({ code }).first();
    if (!old) throw new HttpError(404, 'No such person.');
    const b = req.body as Partial<Employee>;
    const map: [keyof Employee, string, string][] = [['email', 'email', 'Email'], ['officeId', 'office_id', 'Office'], ['calendarId', 'calendar_id', 'Holiday calendar'], ['shiftCode', 'shift_code', 'Usual shift'], ['joinDate', 'join_date', 'Joining date'], ['exitDate', 'exit_date', 'Leaving date'], ['aliases', 'aliases', 'Other names']];
    const update: Record<string, string | null> = {};
    for (const [field, col, label] of map) {
      if (!(field in b)) continue;
      const isDate = field === 'joinDate' || field === 'exitDate';
      const raw = b[field] == null ? '' : String(b[field]).trim();
      if (isDate && raw && !DATE.test(raw)) throw new HttpError(400, `${label} must be a date.`);
      if (field === 'email' && raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw new HttpError(400, 'Enter a valid email address.');
      const before = isDate ? old[col] || null : old[col] ?? '';
      const after = isDate ? raw || null : raw;
      if (before === after) continue;
      update[col] = after;
      await R.audit(who(res), `${old.name}: ${label}`, String(before ?? '') || 'empty', after || 'empty', 'Changed on the People page.', 'People page', code);
    }
    if (Object.keys(update).length) await k('employees').where({ code }).update({ ...update, updated_at: today() });
  }));
  api.post('/months/:month/package', admin, h(async (req) => {
    const m = month(req);
    if (!(await R.latestImport(m))) throw new HttpError(400, 'There is no attendance file for this month yet.');
    const r = await buildPackage(m, 'Built from the Monthly report page');
    return { version: r.version };
  }));
  api.post('/jobs/run', admin, h(async () => ({ lines: await runAll() })));
  api.get('/users', admin, h(async () => (await (await db())('users').select('id', 'email', 'name', 'role').orderBy('name')).map((u) => ({ ...u, id: Number(u.id) }))));
  api.post('/users', admin, h(async (req) => ({ id: await createUser(req.body?.name, req.body?.email, req.body?.password, req.body?.role) })));
  api.put('/users/:id/password', admin, h(async (req, res) => {
    const id = Number(req.params.id);
    await resetPassword(id, req.body?.password);
    const u = await (await db())('users').where({ id }).first();
    await R.audit(who(res), 'User accounts', '', `New password set for ${u?.email ?? id}`, 'Set on the Rules page. Their other sign-ins were ended.', 'Settings');
  }));
  api.delete('/users/:id', admin, h(async (req, res) => {
    const id = Number(req.params.id);
    if (id === (res.locals.user as User).id) throw new HttpError(400, 'You cannot remove your own account.');
    const k = await db();
    await k('sessions').where({ user_id: id }).delete();
    await k('users').where({ id }).delete();
  }));

  api.use((_req, _res, next) => next(new HttpError(404, 'Not found.')));
  api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = err instanceof HttpError ? err.status : (err as { status?: number })?.status ?? 500;
    if (status >= 500) logError(`${_req.method} ${_req.originalUrl}`, err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server. Try again, and check the server log if it keeps happening.' : (err as Error).message });
  });
  return api;
}

function month(req: Request): string {
  const m = String(req.params.month);
  if (!MONTH.test(m)) throw new HttpError(400, 'Month must look like 2026-09.');
  return m;
}

function sendFile(res: Response, buf: Buffer, name: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(buf);
}

function cleanSettings(s: Settings): Settings {
  const num = (v: unknown, min: number, max: number, name: string) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${name} must be between ${min} and ${max}.`);
    return n;
  };
  const emails = (s.reportRecipients ?? []).map((x) => String(x).trim()).filter(Boolean);
  for (const e of [...emails, s.hrEmail]) if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, `${e || 'An email address'} is not a valid email address.`);
  if (!/^\d{2}:\d{2}$/.test(s.hrDigestTime)) throw new HttpError(400, 'Summary time must look like 18:00.');
  return {
    graceMinutes: num(s.graceMinutes, 0, 240, 'Late grace'),
    earlyToleranceMinutes: num(s.earlyToleranceMinutes, 0, 240, 'Early tolerance'),
    shortHoursToleranceMinutes: num(s.shortHoursToleranceMinutes, 0, 600, 'Short hours tolerance'),
    halfDayBelowHours: num(s.halfDayBelowHours, 0, 12, 'Half day hours'),
    systemIssueMinPeople: num(s.systemIssueMinPeople, 2, 100, 'People for a likely system issue'),
    longAbsenceDays: num(s.longAbsenceDays, 2, 60, 'Long absence days'),
    autoApplyConfidence: num(s.autoApplyConfidence, 50, 100, 'Email confidence'),
    remindersOn: Boolean(s.remindersOn),
    reminderAfterDays: num(s.reminderAfterDays, 1, 10, 'Reminder delay'),
    reminderWindowDays: num(s.reminderWindowDays, 1, 60, 'Reminder window'),
    hrDigestOn: Boolean(s.hrDigestOn),
    hrDigestTime: s.hrDigestTime,
    hrEmail: s.hrEmail.trim(),
    closeDay: num(s.closeDay, 1, 28, 'Close day'),
    reportRecipients: emails,
    weeklyOff: [...new Set((s.weeklyOff ?? []).map(Number).filter((d) => d >= 0 && d <= 6))].sort(),
    punchFileName: String(s.punchFileName ?? '').trim() || 'monthdatewiseperformance',
  };
}

function describeSettings(a: Settings, b: Settings): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  const labels: Partial<Record<keyof Settings, string>> = {
    graceMinutes: 'Late grace (min)', earlyToleranceMinutes: 'Early departure tolerance (min)', shortHoursToleranceMinutes: 'Short hours tolerance (min)',
    halfDayBelowHours: 'Half day below (hours)', systemIssueMinPeople: 'Likely system issue from (people)', longAbsenceDays: 'Long absence from (days)',
    autoApplyConfidence: 'Apply emails at confidence (%)', remindersOn: 'Employee reminders', reminderAfterDays: 'Reminder after (working days)',
    reminderWindowDays: 'Remind only for the last (days)', hrDigestOn: 'HR daily summary', hrDigestTime: 'HR summary time', hrEmail: 'HR email',
    closeDay: 'Month closes on day', punchFileName: 'Attendance file name contains',
  };
  for (const [k, label] of Object.entries(labels) as [keyof Settings, string][]) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push({ from: `${label}: ${fmt(a[k])}`, to: fmt(b[k]) });
  }
  if (a.reportRecipients.join() !== b.reportRecipients.join()) out.push({ from: `Report recipients: ${a.reportRecipients.join(', ') || 'none'}`, to: b.reportRecipients.join(', ') || 'none' });
  if (a.weeklyOff.join() !== b.weeklyOff.join()) out.push({ from: 'Weekly off days', to: b.weeklyOff.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') });
  return out;
}

const fmt = (v: unknown) => (typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v));
