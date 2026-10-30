// Everything the tool does on its own. The cron entry (src/cron.ts) calls runAll() every 15 minutes.
import fs from 'node:fs';
import path from 'node:path';
import type { Employee } from '../../shared/types.ts';
import { config, now, storage, today } from './config.ts';
import { logError } from './log.ts';
import { db, insertId } from './db.ts';
import * as R from './repo.ts';
import * as D from './engine/dates.ts';
import { buildMonth, issueKey, NOTIFY_TYPES } from './engine/monthBuilder.ts';
import { importPunchFile } from './import/importer.ts';
import { attachments, graphConfigured, messagesSince } from './mail/graph.ts';
import { esc, layout, send } from './mail/mailer.ts';
import { AiBusyError, aiConfigured, aiName, readEmail } from './ai/emailReader.ts';
import { writeWorkbook } from './reports/excel.ts';
import { needsAttention, summaryLines } from './reports/summary.ts';

export async function runAll(log: (m: string) => void = () => {}): Promise<string[]> {
  const lockFile = path.join(storage(), 'cron.lock');
  try {
    const age = Date.now() - fs.statSync(lockFile).mtimeMs;
    if (age < 20 * 60_000) { log('Another run is still going. Skipped.'); return ['Skipped: another run is still going.']; }
  } catch { /* no lock */ }
  fs.writeFileSync(lockFile, String(process.pid));
  const lines: string[] = [];
  try {
    for (const [name, fn] of [['Mailbox', readMailbox], ['Reminders', sendReminders], ['HR summary', sendDigest], ['Month close', closeMonths]] as const) {
      let line: string;
      try { line = `${name}: ${await fn()}`; } catch (e) { line = `${name} failed: ${(e as Error).message}`; logError(`automatic run: ${name}`, e); }
      lines.push(line);
      log(line);
    }
    await R.setState('last_run', JSON.stringify({ at: now(), lines }));
  } finally {
    fs.rmSync(lockFile, { force: true });
  }
  return lines;
}

/** New emails at hr@: import attached punch files, and read the rest with the AI model. */
export async function readMailbox(): Promise<string> {
  if (!graphConfigured()) return 'Microsoft 365 not connected yet, skipped.';
  const k = await db();
  const rules = await R.getRules();
  const employees = await R.getEmployees();
  const own = [config().microsoft.mailbox, config().microsoft.sender].filter(Boolean).map((a) => a.toLowerCase());
  const pacer = new AiPacer();
  let since = (await R.getState('mail_since')) ?? new Date(Date.now() - 3 * 86400_000).toISOString().replace(/\.\d+Z$/, 'Z');
  let done = 0;
  for (const msg of await messagesSince(since)) {
    since = msg.receivedDateTime;
    if (await k('emails').where({ graph_id: msg.id }).first()) continue;
    const from = msg.from?.emailAddress?.address ?? '';
    if (own.includes(from.toLowerCase())) continue;
    const row: Record<string, unknown> = {
      graph_id: msg.id, from_addr: from, received_at: localStampFromIso(msg.receivedDateTime), subject: (msg.subject ?? '').slice(0, 250),
      body: (msg.uniqueBody?.content || msg.body?.content || '').trim(), dates: '[]', processed_at: now(),
    };
    let handled = false;
    if (msg.hasAttachments) {
      for (const a of await attachments(msg.id)) {
        if (!a.name.toLowerCase().includes(rules.punchFileName.toLowerCase()) || !/\.xlsx?$/i.test(a.name)) continue;
        handled = true;
        try {
          const r = await importPunchFile(a.bytes, a.name, 'email', `Email from ${from}`);
          Object.assign(row, { kind: 'attendance_file', detected: 'Attendance file', confidence: 100, warning: `Imported ${r.months.join(', ')}: ${r.people} people, ${r.days} days.` });
        } catch (e) {
          Object.assign(row, { kind: 'attendance_file', detected: 'Attendance file', error: `The attached file could not be read: ${(e as Error).message}`.slice(0, 480) });
        }
      }
    }
    if (!handled) Object.assign(row, await readWithAi(row as { from_addr: string; received_at: string; subject: string; body: string }, employees, pacer));
    await k('emails').insert(row);
    done++;
  }
  await R.setState('mail_since', since);

  let retried = 0;
  for (const old of await k('emails').whereNot({ error: '' }).whereNot({ kind: 'attendance_file' }).orderBy('id').limit(10)) {
    if (!pacer.canCall()) break;
    const fields = await readWithAi(old, employees, pacer);
    if (!fields.error) retried++;
    await k('emails').where({ id: old.id }).update(fields);
  }
  return `${done} new ${done === 1 ? 'email' : 'emails'}${retried ? `, ${retried} read on retry` : ''}${pacer.note()}.`;
}

/**
 * Keeps within the AI service's limits (the free NVIDIA key allows only a few requests a minute):
 * a pause between emails, a cap per 15-minute run, and no more calls once the service says it is busy.
 * Anything not read now is kept and read on a later run.
 */
class AiPacer {
  private calls = 0;
  private busy = false;
  private readonly max = config().ai.maxPerRun ?? 20;
  private readonly pauseMs = (config().ai.pauseSeconds ?? (config().ai.provider === 'nvidia' ? 3 : 0)) * 1000;

  canCall() { return !this.busy && this.calls < this.max; }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.calls > 0 && this.pauseMs) await new Promise((r) => setTimeout(r, this.pauseMs));
    this.calls++;
    try {
      return await fn();
    } catch (e) {
      if (e instanceof AiBusyError) this.busy = true;
      throw e;
    }
  }

  note() {
    if (this.busy) return '; the AI service was busy, the rest will be read on the next run';
    if (this.calls >= this.max) return `; reached ${this.max} AI reads for this run, the rest will be read on the next run`;
    return '';
  }
}

async function readWithAi(row: { from_addr: string; received_at: string; subject: string; body: string }, employees: Employee[], pacer: AiPacer) {
  if (!aiConfigured()) return { error: `The AI API key is not set in config.json (${aiName()}).` };
  if (!pacer.canCall()) return { error: 'Waiting to be read: the AI limit for this run was reached. It will be read on the next run.' };
  try {
    const r = await pacer.call(() => readEmail({ from: row.from_addr, receivedAt: row.received_at, subject: row.subject, body: row.body }, employees));
    return {
      is_attendance: r.is_attendance ? 1 : 0, kind: r.kind, detected: r.label || r.kind.replace(/_/g, ' '), emp_code: r.employee_code || null,
      dates: JSON.stringify(r.dates), half_day: r.half_day ? 1 : 0, confidence: r.confidence, warning: r.warning, processed_at: now(), error: '',
    };
  } catch (e) {
    return { error: (e as Error).message.slice(0, 480) };
  }
}

/** Reminders to employees, and alerts to HR for long absences and likely device problems. */
export async function sendReminders(): Promise<string> {
  const k = await db();
  const r = await R.getRules();
  const day = today();
  const emps = Object.fromEntries((await R.getEmployees()).map((e) => [e.id, e]));
  const officeList = await R.getOffices();
  const offices = Object.fromEntries(officeList.map((o) => [o.id, o.name]));
  const already = async (key: string) => Boolean(await k('notifications').where({ issue_key: key }).first());
  let count = 0;
  for (const month of [...new Set([D.prevMonth(day.slice(0, 7)), day.slice(0, 7)])]) {
    if (!(await R.latestImport(month))) continue;
    const data = await buildMonth(month);
    for (const x of data.issues) {
      const e = emps[x.employeeId];
      if (!e) continue;
      if (x.state === 'system') {
        const key = `system|${e.officeId}|${x.date}|${x.type}`;
        if (await already(key)) continue;
        const n = data.issues.filter((y) => y.state === 'system' && y.date === x.date && y.type === x.type && emps[y.employeeId]?.officeId === e.officeId).length;
        const subject = `Likely device problem: ${x.type.toLowerCase()} for ${n} people at ${offices[e.officeId] ?? ''} on ${D.day(x.date)}`;
        await send({ to: [r.hrEmail], audience: 'HR', month, subject, html: layout(subject, '<p>These gaps are not counted against the employees. Please check the punch device or its sync for that day.</p>'), issueKey: key });
        count++;
        continue;
      }
      const key = issueKey(x.employeeId, x.date, x.type);
      if (x.state !== 'open' || (await already(key))) continue;
      if (x.type === 'Long absence') {
        const subject = `Long absence: ${e.name} from ${D.short(x.date)}`;
        await send({ to: [r.hrEmail], audience: 'HR', month, subject, html: layout(subject, `<p>${esc(x.detail)}</p>`), issueKey: key });
        count++;
        continue;
      }
      if (!r.remindersOn || !NOTIFY_TYPES.includes(x.type) || !e.email) continue;
      if (x.date < D.addDays(day, -r.reminderWindowDays)) continue;
      if (workingDayAfter(x.date, r.reminderAfterDays, R.officeOf(officeList, e.officeId).weeklyOff ?? r.weeklyOff) > day) continue;
      const ask = x.type === 'Unexplained absence' ? 'please reply to this email with the reason for your absence' : 'please reply to this email with your actual time';
      const subject = `Please check your attendance for ${D.day(x.date)}`;
      const html = layout(subject, `<p>Hi ${esc(e.name.split(' ')[0])},</p><p>Our attendance records show <b>${esc(x.type.toLowerCase())}</b> on ${D.day(x.date)}. ${esc(x.detail)}</p><p>If this is not right, ${ask}. Your reply goes to HR and is applied automatically.</p>`);
      await send({ to: [e.email], audience: 'Employee', month, subject, html, issueKey: key });
      count++;
    }
  }
  return `${count} ${count === 1 ? 'message' : 'messages'}.`;
}

/** One summary email to HR a day, for information only. */
export async function sendDigest(): Promise<string> {
  const r = await R.getRules();
  const day = today();
  if (!r.hrDigestOn) return 'Turned off.';
  if (now().slice(11, 16) < r.hrDigestTime) return 'Not time yet.';
  if ((await R.getState('digest_date')) === day) return 'Already sent today.';
  if (r.weeklyOff.includes(D.dow(day))) return 'Weekly off.';
  const month = day.slice(0, 7);
  let rows = '';
  let total = 0;
  for (const m of [D.prevMonth(month), month]) {
    if (!(await R.latestImport(m))) continue;
    const data = await buildMonth(m);
    const att = data.issues.filter(needsAttention);
    total += att.length;
    const byType = new Map<string, number>();
    for (const x of att) byType.set(x.type, (byType.get(x.type) ?? 0) + 1);
    const parts = [...byType.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${t.toLowerCase()}`);
    rows += `<p><b>${D.monthName(m)}</b>: ${att.length} need attention${parts.length ? ` (${parts.join(', ')})` : ''}.</p>`;
  }
  const newEmails = Number((await (await db())('emails').where('processed_at', '>=', `${D.addDays(day, -1)}T${r.hrDigestTime}`).count({ n: '*' }))[0].n);
  const subject = `Attendance summary for ${D.day(day)}: ${total} need attention`;
  const html = layout(subject, `${rows || '<p>No attendance files yet for this month or last month.</p>'}<p>${newEmails} HR emails were read since yesterday's summary. Nothing here needs approval; the tool keeps everything up to date.</p>`);
  await send({ to: [r.hrEmail], audience: 'HR', month, subject, html });
  await R.setState('digest_date', day);
  return 'Sent.';
}

/** Close each month on the set day (or when its file arrives later) and email the package. A newer file after closing sends a revised package. */
export async function closeMonths(): Promise<string> {
  const k = await db();
  const r = await R.getRules();
  const day = today();
  const done: string[] = [];
  for (const { month } of await k('imports').distinct('month').orderBy('month')) {
    const closeDate = `${D.nextMonth(month)}-${String(r.closeDay).padStart(2, '0')}`;
    if (day < closeDate) continue;
    const last = await k('reports').where({ month }).orderBy('version', 'desc').first();
    const imp = await R.latestImport(month);
    if (last && imp && imp.imported_at <= last.created_at) continue;
    await buildPackage(month, last ? 'Revised: a newer attendance file arrived' : 'Month closed');
    done.push(month);
  }
  return done.length ? `Closed ${done.join(', ')}.` : 'Nothing to close.';
}

/** Build the Excel package, keep it on the server, and email it to the report recipients. */
export async function buildPackage(month: string, note: string) {
  const k = await db();
  const r = await R.getRules();
  const [data, employees, offices] = await Promise.all([buildMonth(month), R.getEmployees(), R.getOffices()]);
  const version = Number((await k('reports').where({ month }).max({ v: 'version' }))[0].v ?? 0) + 1;
  const name = `Attendance-${month}-v${version}.xlsx`;
  const file = path.join(storage(`reports/${month}`), name);
  fs.writeFileSync(file, await writeWorkbook(data, employees, offices));
  const id = await insertId(k, 'reports', { month, version, path: file, created_at: now(), sent_to: JSON.stringify(r.reportRecipients), note });
  const lines = summaryLines(data, Object.fromEntries(employees.map((e) => [e.id, e])));
  const subject = `Attendance ${D.monthName(month)}${version > 1 ? ` (revised, version ${version})` : ''}`;
  const html = layout(subject, `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><p>The full workbook is attached: summary, master sheet, daily detail, issues, HR emails and change log. It is also saved in Attendance Desk under Monthly report.</p>`);
  if (r.reportRecipients.length) await send({ to: r.reportRecipients, audience: 'Management', month, subject, html, files: [{ name, path: file }] });
  return { id, version, file };
}

function workingDayAfter(date: string, n: number, weeklyOff: number[]): string {
  let d = date;
  for (let i = 0; i < Math.max(1, n); ) {
    d = D.addDays(d, 1);
    if (!weeklyOff.includes(D.dow(d))) i++;
  }
  return d;
}

/** Graph gives UTC; store local time like everything else. */
function localStampFromIso(isoUtc: string): string {
  const d = new Date(isoUtc);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
