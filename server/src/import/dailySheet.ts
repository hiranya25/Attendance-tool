// A daily attendance sheet kept by hand, like Mumbai's:
//   Date       | Sahil | Mahendra | Jainam | ...
//   01/09/2026 | L1    | OK       | OK     |
//   02/09/2026 | OK    | A        | OK     |
// OK = present, L1..Ln = present and marked late (the sheet's own count), A = absent, blank = not a working day.
// Summary rows at the bottom (A / L totals) are ignored.
import type { RawDay } from './punchReport.ts';

export interface DailySheet {
  months: string[];
  names: string[];
  days: (Omit<RawDay, 'emp_code'> & { name: string })[];
}

const DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function isDailySheet(rows: string[][]): boolean {
  const head = rows[0]?.map((c) => c.trim().toLowerCase()) ?? [];
  return head[0] === 'date' && head.slice(1).some(Boolean) && rows.slice(1).some((r) => DATE.test(String(r[0] ?? '').trim()));
}

export function parseDailySheet(rows: string[][]): DailySheet {
  const head = rows[0].map((c) => c.trim());
  const cols = head.map((h, i) => ({ h, i })).filter(({ h, i }) => i > 0 && h);
  const out: DailySheet = { months: [], names: cols.map((c) => c.h), days: [] };
  const months = new Set<string>();
  for (const r of rows.slice(1)) {
    const m = DATE.exec(String(r[0] ?? '').trim());
    if (!m) continue;
    const date = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    months.add(date.slice(0, 7));
    for (const { h, i } of cols) {
      const v = String(r[i] ?? '').trim().toUpperCase();
      if (!v) continue; // not a working day, or nothing written: the office's weekly off decides
      const late = /^L\d*$/.test(v);
      const status = v === 'OK' || v === 'P' || late ? 'P' : v === 'A' || v === 'AB' ? 'A' : v === 'HD' || v === 'H/D' || v === 'P/2' ? 'P/2' : v === 'H' || v === 'HL' ? 'HL' : v === 'WO' ? 'WO' : v === 'LV' || v === 'LEAVE' ? 'LV' : 'P';
      out.days.push({ name: h, date, shift: 'SHEET', in_min: null, out_min: null, work_min: 0, ot_min: 0, less_min: 0, status, remark: late ? `LT (${v})` : status === 'P' && v !== 'OK' && v !== 'P' ? v : '' });
    }
  }
  out.months = [...months].sort();
  return out;
}
