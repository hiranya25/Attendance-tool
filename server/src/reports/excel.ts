// The monthly package as one Excel workbook: summary, master sheet, daily detail, issues, emails and change log.
import ExcelJS from 'exceljs';
import type { DayRecord, Employee, MonthData, Office } from '../../../shared/types.ts';
import { codeLabel } from '../engine/monthBuilder.ts';
import * as D from '../engine/dates.ts';
import { patterns, summaryLines, totals } from './summary.ts';

const STATE: Record<string, string> = { open: 'Open', reminded: 'Reminder sent', unclear: 'Communicated, unclear', explained: 'Explained by email', fixed: 'Fixed by later data', system: 'Likely system issue' };
const FILL: Record<string, string> = { P: 'D9F0E2', HD: 'F8EBC8', A: 'F9DFDB', LV: 'D3EBE7', HL: 'DDE7F6', WO: 'E7ECEE', NR: 'F8EBC8', NE: 'F1F4F5' };
const HEAD_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7ECEE' } };

export type ExcelPart = 'all' | 'master' | 'issues';

export async function writeWorkbook(data: MonthData, employees: Employee[], offices: Office[], part: ExcelPart = 'all'): Promise<Buffer> {
  const emps = Object.fromEntries(employees.map((e) => [e.id, e]));
  const off = Object.fromEntries(offices.map((o) => [o.id, o.name]));
  const name = (id: string) => emps[id]?.name ?? id;
  const office = (id: string) => off[emps[id]?.officeId ?? ''] ?? '';
  const book = new ExcelJS.Workbook();
  book.creator = 'Attendance Desk';
  book.title = `Attendance ${D.monthName(data.month)}`;

  if (part === 'all') {
    const s = book.addWorksheet('Summary');
    s.getColumn(1).width = 110;
    [2, 3, 4].forEach((c) => (s.getColumn(c).width = 20));
    s.addRow([`Attendance ${D.monthName(data.month)}`]).font = { bold: true, size: 16 };
    s.addRow([`Data up to ${D.day(data.dataThrough)}. Built automatically by Attendance Desk.`]);
    s.addRow([]);
    for (const line of summaryLines(data, emps)) s.addRow([`• ${line}`]);
    s.addRow([]);
    s.addRow(['Repeat patterns']).font = { bold: true };
    head(s.addRow(['Person', 'Late arrivals', 'Unexplained absences', 'Missing punches']));
    for (const [id, p] of Object.entries(patterns(data.issues))) s.addRow([name(id), p.lates, p.unexplained, p.punches]);
  }

  if (part === 'all' || part === 'master') {
    const s = book.addWorksheet('Master', { views: [{ state: 'frozen', xSplit: 4, ySplit: 1 }] });
    const dates = D.monthDates(data.month);
    head(s.addRow(['Code', 'Name', 'Office', 'Department', ...dates.map((d) => Number(d.slice(8))), 'Present', 'Absent', 'Leave', 'Holiday', 'Weekly off', 'Hours']));
    for (const [id, days] of Object.entries(data.records)) {
      const t = totals(Object.values(days));
      const row = s.addRow([id, name(id), office(id), emps[id]?.department ?? '', ...dates.map((d) => cellCode(days[d])), t.present, t.absent, t.leave, t.holiday, t.weeklyOff, D.hhmm(t.minutes)]);
      dates.forEach((d, i) => {
        const fill = FILL[days[d]?.code ?? ''];
        if (fill) row.getCell(5 + i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fill}` } };
        row.getCell(5 + i).alignment = { horizontal: 'center' };
      });
    }
    s.getColumn(2).width = 28;
    s.getColumn(3).width = 18;
    s.getColumn(4).width = 14;
    dates.forEach((_, i) => (s.getColumn(5 + i).width = 4.5));
    s.addRow([]);
    s.addRow(['P present, ½ half day, A absent, SL/PL/UL/OL sick/planned/unpaid/other leave, H holiday, WO weekly off, ? no record, - not employed.']);
  }

  if (part === 'all') {
    const rows: (string | number)[][] = [];
    for (const [id, days] of Object.entries(data.records)) {
      for (const d of Object.values(days)) {
        if (d.code === 'F') continue;
        rows.push([d.date, id, name(id), office(id), d.shift ?? '', d.leaveType ?? codeLabel(d.code),
          d.scheduledStart != null ? `${D.hm(d.scheduledStart)}-${D.hm(d.scheduledEnd)}` : '', d.login != null ? D.hm(d.login) : '', d.logout != null ? D.hm(d.logout) : '',
          d.minutesWorked != null ? D.hhmm(d.minutesWorked) : '', d.device?.status ?? '', d.device?.remark ?? '', d.original ? codeLabel(d.original.code) : '', d.note ?? '']);
      }
    }
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
    table(book, 'Daily detail', ['Date', 'Code', 'Name', 'Office', 'Shift', 'Status', 'Scheduled', 'In', 'Out', 'Hours', 'Punch system status', 'Punch system remark', 'Changed by tool from', 'Note'], rows);
  }

  if (part === 'all' || part === 'issues') {
    const rows = data.issues.map((x) => [x.date, x.employeeId, name(x.employeeId), office(x.employeeId), x.type, x.severity[0].toUpperCase() + x.severity.slice(1), STATE[x.state] ?? x.state, x.detail]);
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[2]).localeCompare(String(b[2])));
    table(book, 'Issues', ['Date', 'Code', 'Name', 'Office', 'Issue', 'Priority', 'Status', 'Detail'], rows);
  }

  if (part === 'all') {
    table(book, 'HR emails', ['Received', 'From', 'Subject', 'Understood as', 'Person', 'Days', 'Confidence', 'What the tool did'],
      data.emails.map((m) => [m.receivedAt.replace('T', ' '), m.from, m.subject, m.detected, m.employeeId ? name(m.employeeId) : '', m.dates.join(', '), `${m.confidence}%`, m.action]));
    table(book, 'Change log', ['When', 'Who', 'Day', 'From', 'To', 'Why', 'Source'],
      data.changes.map((c) => [c.at.replace('T', ' '), c.employeeId ? name(c.employeeId) : c.subject ?? '', c.date?.length === 10 ? c.date : '', c.from, c.to, c.reason, c.source]));
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

function head(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((c) => (c.fill = HEAD_FILL));
}

function table(book: ExcelJS.Workbook, title: string, header: string[], rows: (string | number)[][]) {
  const s = book.addWorksheet(title, { views: [{ state: 'frozen', ySplit: 1 }] });
  head(s.addRow(header));
  for (const r of rows) s.addRow(r);
  s.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: header.length } };
  header.forEach((h, i) => {
    const widest = rows.slice(0, 300).reduce((w, r) => Math.max(w, String(r[i] ?? '').length), h.length);
    s.getColumn(i + 1).width = Math.min(60, Math.max(10, widest + 2));
  });
}

function cellCode(d: DayRecord | undefined): string {
  if (!d) return '';
  switch (d.code) {
    case 'HD': return '½';
    case 'HL': return 'H';
    case 'NR': return '?';
    case 'NE': return '-';
    case 'F': return '';
    case 'LV': return ({ 'Sick leave': 'SL', 'Planned leave': 'PL', 'Unpaid leave': 'UL' } as Record<string, string>)[d.leaveType ?? ''] ?? 'OL';
    default: return d.code;
  }
}
