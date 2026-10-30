// Reads the punch system's "Month Date Wise Performance" export (.xls or .xlsx).
//
// Layout, repeated for each employee:
//   AMIPI INC
//   Dept. Name | <dept> | ... | Report Month | ... | September-2026
//   Empcode | 0001 | ... | Name | Lokesh Soni
//   Date | Day | Shift | IN | OUT | Work+OT | OT | Less Hrs | Status | Remark
//   01/09/2026 | Tue | G | 09:39 | 18:28 | 09:13 | 00:13 | 00:00 | P | OT
//   ...
//   Total Hours ... / Total Pre. : 21 ...
import { readSheetRows } from './spreadsheet.ts';

export interface RawDay {
  emp_code: string;
  date: string;
  shift: string;
  in_min: number | null;
  out_min: number | null;
  work_min: number;
  ot_min: number;
  less_min: number;
  status: string;
  remark: string;
}

export interface PunchReport {
  months: string[];
  employees: Record<string, { name: string; department: string }>;
  days: RawDay[];
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export async function readPunchReport(buf: Buffer, fileName: string): Promise<PunchReport> {
  const rows = await readSheetRows(buf);
  if (!rows.length) throw new Error(`${fileName} is empty.`);
  return parseRows(rows);
}

/** True when the rows look like the punch system's export. */
export function isPunchReport(rows: string[][]): boolean {
  return rows.some((r) => String(r[0] ?? '').trim() === 'Empcode');
}

export function parseRows(rows: string[][]): PunchReport {
  const out: PunchReport = { months: [], employees: {}, days: [] };
  const months = new Set<string>();
  let dept = '';
  let emp: string | null = null;
  let header = false;
  for (const raw of rows) {
    const cells = raw.map((c) => String(c ?? '').trim());
    const first = cells[0] ?? '';
    if (first === 'Dept. Name') {
      dept = cells[1] ?? '';
      for (const c of cells) {
        const m = /^([A-Za-z]+)-(\d{4})$/.exec(c);
        const idx = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
        if (m && idx >= 0) months.add(`${m[2]}-${String(idx + 1).padStart(2, '0')}`);
      }
      continue;
    }
    if (first === 'Empcode') {
      const code = cells[1] ?? '';
      const nameIdx = cells.indexOf('Name');
      const name = nameIdx >= 0 ? cells.slice(nameIdx + 1).find((c) => c !== '') ?? '' : '';
      emp = code || null;
      if (code) out.employees[code] = { name, department: dept };
      header = false;
      continue;
    }
    if (first === 'Date') { header = true; continue; }
    if (!emp || !header) continue;
    const date = parseDate(first);
    if (!date) continue;
    out.days.push({
      emp_code: emp,
      date,
      shift: cells[2] ?? '',
      in_min: parseTime(cells[3]),
      out_min: parseTime(cells[4]),
      work_min: parseTime(cells[5]) ?? 0,
      ot_min: parseTime(cells[6]) ?? 0,
      less_min: parseTime(cells[7]) ?? 0,
      status: (cells[8] ?? '').toUpperCase(),
      remark: cells[9] === '--' ? '' : cells[9] ?? '',
    });
  }
  out.months = [...months].sort();
  if (!out.months.length && out.days.length) out.months = [out.days[0].date.slice(0, 7)];
  return out;
}

/** "01/09/2026" (day first) -> "2026-09-01" */
function parseDate(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCMonth() !== mo - 1) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "09:39" -> 579, "--:--" -> null */
function parseTime(s: string | undefined): number | null {
  const m = /^(\d{1,3}):(\d{2})$/.exec(s ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
