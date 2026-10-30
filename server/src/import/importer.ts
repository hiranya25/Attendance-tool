// Takes in any of the three files the tool understands, works out which one it is, and stores it.
//   1. The punch system's "Month Date Wise Performance" export (Indore and remote staff)
//   2. A daily attendance sheet kept by hand (Mumbai: OK / L1 / A per person per day)
//   3. The team list (name, manager, work hours, location, email, role)
// Attendance rows are kept exactly as sent; a newer file of the same kind for a month replaces the older one in use.
import fs from 'node:fs';
import path from 'node:path';
import type { Knex } from 'knex';
import { db, insertId } from '../db.ts';
import { now, storage } from '../config.ts';
import { getEmployees, getOffices } from '../repo.ts';
import { readSheetRows } from './spreadsheet.ts';
import { isPunchReport, parseRows, type RawDay } from './punchReport.ts';
import { isDailySheet, parseDailySheet } from './dailySheet.ts';
import { applyTeamList, isTeamList, matchTeam, parseTeamList, slug, titleCase, type TeamImportResult } from './teamList.ts';

export interface ImportResult {
  kind: 'punch' | 'sheet' | 'team';
  months: string[];
  people: number;
  days: number;
  newPeople: string[];
  team?: TeamImportResult;
}

export async function importFile(buf: Buffer, fileName: string, source: 'upload' | 'email', by: string): Promise<ImportResult> {
  const rows = await readSheetRows(buf);
  if (!rows.length) throw new Error(`${fileName} is empty.`);
  if (isPunchReport(rows)) return importPunch(rows, buf, fileName, source, by);
  if (isTeamList(rows)) return importTeam(rows, buf, fileName, by);
  if (isDailySheet(rows)) return importDailySheet(rows, buf, fileName, source, by);
  throw new Error('This file was not recognised. Upload the punch system\'s "Month Date Wise Performance" export, the Mumbai attendance sheet (first column "Date", one column per person), or the team list (columns NAME, MANAGER, LOCATION).');
}

/** Kept for older callers. */
export const importPunchFile = importFile;

function keepFile(buf: Buffer, fileName: string): string {
  const safe = path.basename(fileName).replace(/[^A-Za-z0-9._-]+/g, '_');
  const dest = path.join(storage('imports'), `${now().replace(/[-:T]/g, '')}-${Date.now() % 100000}-${safe}`);
  fs.writeFileSync(dest, buf);
  return dest;
}

async function storeMonths(trx: Knex.Transaction, scope: string, days: RawDay[], months: string[], meta: { fileName: string; dest: string; source: string; by: string; at: string; label: string }) {
  for (const month of months) {
    const monthDays = days.filter((d) => d.date.startsWith(month));
    const people = new Set(monthDays.map((d) => d.emp_code)).size;
    const id = await insertId(trx, 'imports', { scope, month, file_name: meta.fileName, stored_path: meta.dest, source: meta.source, imported_at: meta.at, imported_by: meta.by, people, days: monthDays.length });
    for (let i = 0; i < monthDays.length; i += 200) await trx('raw_days').insert(monthDays.slice(i, i + 200).map((d) => ({ import_id: id, ...d })));
    await trx('audit').insert({
      at: meta.at, user_name: meta.by, subject: meta.label, emp_code: null, date: month, from_val: '', to_val: `Imported ${meta.fileName}`.slice(0, 500),
      reason: `${people} people, ${monthDays.length} days for ${month}. An earlier file of this kind for the month is kept but no longer used.`, source: meta.source === 'email' ? 'Attendance file (email)' : 'Attendance file',
    });
  }
}

async function importPunch(rows: string[][], buf: Buffer, fileName: string, source: 'upload' | 'email', by: string): Promise<ImportResult> {
  const report = parseRows(rows);
  if (!report.days.length) throw new Error('No attendance rows were found in this punch export.');
  const dest = keepFile(buf, fileName);
  const k = await db();
  const offices = await getOffices();
  const at = now();
  const newPeople: string[] = [];
  const merged: string[] = [];
  // People added earlier from the team list or a sheet (codes like "IND-TARUN-PATHAK") are the same people as in the
  // punch file. Link them by name so they are not listed twice; the punch code becomes their code.
  const added = (await getEmployees()).filter((e) => !/^\d+$/.test(e.id));
  const newCodes = Object.keys(report.employees).filter((c) => !added.some((a) => a.id === c));
  const asRows = newCodes.map((c) => ({ name: report.employees[c].name, manager: '', workHours: '', location: '', email: '', role: '' }));
  const links = matchTeam(asRows, added);
  await k.transaction(async (trx) => {
    await storeMonths(trx, 'punch', report.days, report.months, { fileName, dest, source, by, at, label: 'Attendance file' });
    for (const [i, oldCode] of links) {
      const code = newCodes[i];
      if (await trx('employees').where({ code }).first()) continue;
      const e = report.employees[code];
      const office = offices.find((o) => o.departments.includes(e.department))?.id;
      await trx('employees').where({ code: oldCode }).update({ code, name: e.name, department: e.department, ...(office ? { office_id: office } : {}), shift_code: mainShift(report.days, code), updated_at: at });
      await trx('raw_days').where({ emp_code: oldCode }).update({ emp_code: code });
      await trx('audit').where({ emp_code: oldCode }).update({ emp_code: code });
      merged.push(e.name);
    }
    for (const [code, e] of Object.entries(report.employees)) {
      const existing = await trx('employees').where({ code }).first();
      if (existing) {
        if (existing.name !== e.name) await trx('employees').where({ code }).update({ name: e.name, updated_at: at });
        continue;
      }
      const shift = mainShift(report.days, code);
      const office = offices.find((o) => o.departments.includes(e.department))?.id ?? 'indore';
      const calendar = office === 'remote' ? 'us' : shift === 'D' ? 'india-day' : office === 'mumbai' ? 'mumbai' : 'ny-shift';
      await trx('employees').insert({
        code, name: e.name, department: e.department, office_id: office, shift_code: shift, calendar_id: calendar, email: '',
        aliases: /\(([^)]+)\)/.exec(e.name)?.[1]?.trim() ?? '', join_date: null, exit_date: null, updated_at: at,
      });
      if (shift && !(await trx('shifts').where({ code: shift }).first())) {
        await trx('shifts').insert({ code: shift, name: `Shift ${shift}`, start_min: 600, end_min: 1140, confirmed: 0 });
      }
      newPeople.push(e.name);
    }
    if (newPeople.length) await auditNewPeople(trx, at, by, report.months[0] ?? null, newPeople, 'the attendance file');
    if (merged.length) {
      await trx('audit').insert({
        at, user_name: by, subject: 'Employee list', emp_code: null, date: report.months[0] ?? null, from_val: '', to_val: `Linked ${merged.length} people to their punch codes`,
        reason: `Already on the team list: ${merged.join(', ')}.`.slice(0, 500), source: 'Employee list',
      });
    }
  });
  return { kind: 'punch', months: report.months, people: Object.keys(report.employees).length, days: report.days.length, newPeople };
}

/** A hand-kept daily sheet. Names are matched to the office's people; anyone unknown is added and flagged. */
async function importDailySheet(rows: string[][], buf: Buffer, fileName: string, source: 'upload' | 'email', by: string): Promise<ImportResult> {
  const sheet = parseDailySheet(rows);
  if (!sheet.days.length) throw new Error('No attendance rows were found in this sheet.');
  const offices = await getOffices();
  const office = offices.find((o) => o.mode === 'sheet') ?? offices.find((o) => o.id === 'mumbai')!;
  const people = (await getEmployees()).filter((e) => e.officeId === office.id);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  const dest = keepFile(buf, fileName);
  const k = await db();
  const at = now();
  const newPeople: string[] = [];
  const codeOf = new Map<string, string>();
  await k.transaction(async (trx) => {
    for (const name of sheet.names) {
      const n = norm(name);
      const hits = people.filter((e) => {
        const forms = [norm(e.name), norm(e.name).split(' ')[0], ...e.aliases.split(/[,;/]/).map(norm)];
        return forms.includes(n);
      });
      if (hits.length === 1) { codeOf.set(name, hits[0].id); continue; }
      let code = `MUM-${slug(name)}`;
      const existing = await trx('employees').where({ code }).first();
      if (!existing) {
        await trx('employees').insert({
          code, name: titleCase(name), department: '', office_id: office.id, shift_code: 'MUM', calendar_id: 'mumbai', email: '', aliases: '',
          join_date: null, exit_date: null, updated_at: at, location: office.name, work_hours: 'Full Time', tracked: 1,
        });
        newPeople.push(titleCase(name));
      }
      codeOf.set(name, code);
    }
    const days: RawDay[] = sheet.days.map(({ name, ...d }) => ({ ...d, emp_code: codeOf.get(name)! }));
    await storeMonths(trx, `sheet-${office.id}`, days, sheet.months, { fileName, dest, source, by, at, label: `${office.name} attendance sheet` });
    if (newPeople.length) await auditNewPeople(trx, at, by, sheet.months[0] ?? null, newPeople, `the ${office.name} sheet (not matched to anyone on the team list)`);
  });
  return { kind: 'sheet', months: sheet.months, people: sheet.names.length, days: sheet.days.length, newPeople };
}

async function importTeam(rows: string[][], buf: Buffer, fileName: string, by: string): Promise<ImportResult> {
  const team = parseTeamList(rows);
  if (!team.length) throw new Error('No people were found in this team list.');
  keepFile(buf, fileName);
  const k = await db();
  const at = now();
  const known = await getEmployees();
  let result!: TeamImportResult;
  await k.transaction(async (trx) => {
    result = await applyTeamList(trx, team, known, at);
    await trx('audit').insert({
      at, user_name: by, subject: 'Team list', emp_code: null, date: at.slice(0, 7), from_val: '', to_val: `Imported ${fileName}`.slice(0, 500),
      reason: `${result.updated.length} people updated, ${result.added.length} added, ${result.notTracked.length} not tracked (NA).`.slice(0, 500), source: 'Team list',
    });
  });
  return { kind: 'team', months: [], people: team.length, days: 0, newPeople: result.added, team: result };
}

async function auditNewPeople(trx: Knex.Transaction, at: string, by: string, month: string | null, names: string[], from: string) {
  await trx('audit').insert({
    at, user_name: by, subject: 'Employee list', emp_code: null, date: month, from_val: '', to_val: `Added ${names.length} people`,
    reason: `New in ${from}: ${names.join(', ')}. Check them on the People page.`.slice(0, 500), source: 'Employee list',
  });
}

function mainShift(days: RawDay[], code: string): string {
  const count = new Map<string, number>();
  for (const d of days) if (d.emp_code === code && d.shift && d.shift !== 'X') count.set(d.shift, (count.get(d.shift) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'G';
}
