import type { Calendar, Employee, Holiday, Office, Settings, Shift } from '../../shared/types.ts';
import { db } from './db.ts';
import { now, today } from './config.ts';
import { OFFICES, RULES } from './seed.ts';

export interface ImportRow { id: number; scope: string; month: string; file_name: string; stored_path: string; source: string; imported_at: string; imported_by: string; people: number; days: number }
export interface RawRow { emp_code: string; date: string; shift: string; in_min: number | null; out_min: number | null; work_min: number; ot_min: number; less_min: number; status: string; remark: string }

export async function getRules(): Promise<Settings> {
  const row = await (await db())('settings').where({ name: 'rules' }).first();
  return { ...RULES, ...(row ? JSON.parse(row.value) : {}) };
}

export async function saveRules(r: Settings) {
  const k = await db();
  await k('settings').where({ name: 'rules' }).update({ value: JSON.stringify(r) });
}

/** Offices with their rules. Offices saved before per-office rules existed take the defaults. */
export async function getOffices(): Promise<Office[]> {
  const row = await (await db())('settings').where({ name: 'offices' }).first();
  const stored: Office[] = row ? JSON.parse(row.value) : [];
  const out = OFFICES.map((d) => {
    const s = stored.find((o) => o.id === d.id);
    return s && s.mode ? { ...d, ...s } : d;
  });
  for (const s of stored) if (!out.some((o) => o.id === s.id)) out.push(s);
  return out;
}

export async function saveOffices(offices: Office[]) {
  const k = await db();
  const n = await k('settings').where({ name: 'offices' }).update({ value: JSON.stringify(offices) });
  if (!n) await k('settings').insert({ name: 'offices', value: JSON.stringify(offices) });
}

export function officeOf(offices: Office[], id: string): Office {
  return offices.find((o) => o.id === id) ?? OFFICES[0];
}

export function deptLabel(dept: string): string {
  return dept.replace(/^AMIPI\s*-?\s*/i, '').trim() || dept;
}

export async function getEmployees(): Promise<Employee[]> {
  const rows = await (await db())('employees').orderBy(['office_id', 'code']);
  return rows.map((e) => ({
    id: e.code, name: e.name, officeId: e.office_id, department: deptLabel(e.department), email: e.email,
    joinDate: e.join_date || null, exitDate: e.exit_date || null, shiftCode: e.shift_code, calendarId: e.calendar_id, aliases: e.aliases,
    manager: e.manager ?? '', role: e.role ?? '', location: e.location ?? '', workHours: e.work_hours ?? '', tracked: e.tracked == null ? true : Boolean(Number(e.tracked)),
  }));
}

export async function getCalendars(): Promise<Calendar[]> {
  const rows = await (await db())('calendars').orderBy(['sort', 'name']);
  return rows.map((c) => ({ id: c.id, name: c.name, description: c.description }));
}

export async function getHolidays(): Promise<Holiday[]> {
  const rows = await (await db())('holidays').orderBy('date');
  return rows.map((h) => ({ date: h.date, name: h.name, calendar: h.calendar_id }));
}

export async function getShifts(): Promise<Shift[]> {
  const rows = await (await db())('shifts').orderBy('code');
  return rows.map((s) => ({ code: s.code, name: s.name, start: Number(s.start_min), end: Number(s.end_min), confirmed: Boolean(Number(s.confirmed)) }));
}

/** Months that have attendance data, plus the current month. */
export async function getMonths(): Promise<string[]> {
  const rows = await (await db())('imports').distinct('month');
  const set = new Set<string>(rows.map((r) => r.month));
  set.add(today().slice(0, 7));
  return [...set].sort();
}

/** The newest file of each kind for a month: one punch export and one Mumbai sheet can both be in use. */
export async function latestImports(month: string): Promise<ImportRow[]> {
  const rows: ImportRow[] = await (await db())('imports').where({ month }).orderBy('id', 'desc');
  const seen = new Set<string>();
  return rows.filter((r) => {
    const scope = r.scope || 'punch';
    if (seen.has(scope)) return false;
    seen.add(scope);
    return true;
  });
}

/** The newest import of any kind for a month, or undefined when the month has no data. */
export async function latestImport(month: string): Promise<ImportRow | undefined> {
  return (await latestImports(month))[0];
}

export async function previousImport(month: string, beforeId: number, scope = 'punch'): Promise<ImportRow | undefined> {
  return (await db())('imports').where({ month, scope }).andWhere('id', '<', beforeId).orderBy('id', 'desc').first();
}

export async function rawDays(importId: number): Promise<RawRow[]> {
  const rows = await (await db())('raw_days').where({ import_id: importId }).orderBy(['emp_code', 'date']);
  return rows.map((r) => ({ ...r, in_min: r.in_min == null ? null : Number(r.in_min), out_min: r.out_min == null ? null : Number(r.out_min), work_min: Number(r.work_min), ot_min: Number(r.ot_min), less_min: Number(r.less_min) }));
}

export async function audit(who: string, subject: string, from: string, to: string, reason: string, source: string, emp: string | null = null, date: string | null = null) {
  await (await db())('audit').insert({ at: now(), user_name: who, subject, emp_code: emp, date, from_val: from.slice(0, 500), to_val: to.slice(0, 500), reason: reason.slice(0, 500), source });
}

export async function getState(name: string): Promise<string | null> {
  const row = await (await db())('state').where({ name }).first();
  return row ? row.value : null;
}

export async function setState(name: string, value: string) {
  const k = await db();
  const n = await k('state').where({ name }).update({ value });
  if (!n) await k('state').insert({ name, value });
}
