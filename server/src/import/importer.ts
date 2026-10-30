import fs from 'node:fs';
import path from 'node:path';
import { db, insertId } from '../db.ts';
import { now, storage } from '../config.ts';
import { getOffices } from '../repo.ts';
import { readPunchReport, type RawDay } from './punchReport.ts';

export interface ImportResult { months: string[]; people: number; days: number; newPeople: string[] }

/** Stores a punch file, keeps every row exactly as sent, and adds anyone new to the employee list. */
export async function importPunchFile(buf: Buffer, fileName: string, source: 'upload' | 'email', by: string): Promise<ImportResult> {
  const report = await readPunchReport(buf, fileName);
  if (!report.days.length) throw new Error('No attendance rows were found. Upload the "Month Date Wise Performance" export from the punch system.');
  const safe = path.basename(fileName).replace(/[^A-Za-z0-9._-]+/g, '_');
  const dest = path.join(storage('imports'), `${now().replace(/[-:T]/g, '')}-${Date.now() % 100000}-${safe}`);
  fs.writeFileSync(dest, buf);

  const k = await db();
  const offices = await getOffices();
  const at = now();
  const newPeople: string[] = [];
  await k.transaction(async (trx) => {
    for (const month of report.months) {
      const days = report.days.filter((d) => d.date.startsWith(month));
      const people = new Set(days.map((d) => d.emp_code)).size;
      const id = await insertId(trx, 'imports', { month, file_name: fileName, stored_path: dest, source, imported_at: at, imported_by: by, people, days: days.length });
      for (let i = 0; i < days.length; i += 200) await trx('raw_days').insert(days.slice(i, i + 200).map((d) => ({ import_id: id, ...d })));
      await trx('audit').insert({
        at, user_name: by, subject: 'Attendance file', emp_code: null, date: month, from_val: '', to_val: `Imported ${fileName}`.slice(0, 500),
        reason: `${people} people, ${days.length} days for ${month}. Earlier files for this month are kept but no longer used.`, source: source === 'email' ? 'Attendance file (email)' : 'Attendance file',
      });
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
    if (newPeople.length) {
      await trx('audit').insert({
        at, user_name: by, subject: 'Employee list', emp_code: null, date: report.months[0] ?? null, from_val: '', to_val: `Added ${newPeople.length} people`,
        reason: `New in the attendance file: ${newPeople.join(', ')}. Add their email and joining date on the People page.`.slice(0, 500), source: 'Employee list',
      });
    }
  });
  return { months: report.months, people: Object.keys(report.employees).length, days: report.days.length, newPeople };
}

function mainShift(days: RawDay[], code: string): string {
  const count = new Map<string, number>();
  for (const d of days) if (d.emp_code === code && d.shift && d.shift !== 'X') count.set(d.shift, (count.get(d.shift) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'G';
}
