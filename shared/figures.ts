// The key figures for one month, worked out the same way on the Monthly report screen and in the PDF report.
// Everything here comes from that month's own data only.
import type { DayRecord, Issue, MonthData } from './types';

export interface MonthFigures {
  people: number;
  workdays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  holidays: number;
  presentRate: number;
  /** Average hours worked on a present day, in minutes. */
  avgMinutes: number;
  lateMarks: number;
  latesBeyond: number;
  earlyDepartures: number;
  shortHours: number;
  missingPunches: number;
  unexplained: number;
  communicated: number;
  itemsFound: number;
  needAttention: number;
  emailsRead: number;
  emailsApplied: number;
  offDaysWorked: number;
}

const ATTENTION = ['open', 'reminded', 'unclear'];
const isUnexplained = (x: Issue) => (x.type === 'Unexplained absence' || x.type === 'Long absence') && (x.state === 'open' || x.state === 'reminded');

export function monthFigures(d: MonthData): MonthFigures {
  const days: DayRecord[] = Object.values(d.records).flatMap((r) => Object.values(r));
  let present = 0, absent = 0, half = 0, leave = 0, holidays = 0, workdays = 0, minutes = 0, worked = 0, offWorked = 0;
  for (const x of days) {
    if (x.code === 'P') present++;
    if (x.code === 'HD') { present += 0.5; absent += 0.5; half++; }
    if (x.code === 'A') absent++;
    if (x.code === 'LV') leave++;
    if (x.code === 'HL') holidays++;
    if (['P', 'HD', 'A', 'NR'].includes(x.code)) workdays++;
    if ((x.code === 'P' || x.code === 'HD') && x.minutesWorked) { minutes += x.minutesWorked; worked++; }
    if (x.note?.startsWith('Worked on a')) offWorked++;
  }
  const real = d.issues.filter((x) => x.state !== 'system');
  const count = (type: string) => real.filter((x) => x.type === type).length;
  return {
    people: Object.keys(d.records).length,
    workdays,
    presentDays: present,
    absentDays: absent,
    halfDays: half,
    leaveDays: leave,
    holidays,
    presentRate: workdays ? Math.round((present / workdays) * 1000) / 10 : 0,
    avgMinutes: worked ? Math.round(minutes / worked) : 0,
    lateMarks: count('Late arrival'),
    latesBeyond: d.issues.filter((x) => x.type === 'Late arrival' && x.state === 'open').length,
    earlyDepartures: count('Early departure'),
    shortHours: count('Short hours'),
    missingPunches: real.filter((x) => ['Missing punch-in', 'Missing punch-out', 'Missing record'].includes(x.type)).length,
    unexplained: d.issues.filter(isUnexplained).length,
    communicated: d.issues.filter((x) => x.state === 'explained' || x.state === 'unclear').length,
    itemsFound: real.length,
    needAttention: d.issues.filter((x) => ATTENTION.includes(x.state)).length,
    emailsRead: d.emails.length,
    emailsApplied: d.emails.filter((m) => m.outcome === 'applied').length,
    offDaysWorked: offWorked,
  };
}

/** Rows for "this month against the previous month". `good` says which direction is an improvement. */
export const COMPARE: { key: keyof MonthFigures; label: string; good: 'up' | 'down' | 'none'; unit?: '%' | 'h' }[] = [
  { key: 'people', label: 'People tracked', good: 'none' },
  { key: 'presentRate', label: 'Present rate', good: 'up', unit: '%' },
  { key: 'avgMinutes', label: 'Average hours on a present day', good: 'up', unit: 'h' },
  { key: 'leaveDays', label: 'Leave days', good: 'none' },
  { key: 'halfDays', label: 'Half days', good: 'down' },
  { key: 'absentDays', label: 'Absent days', good: 'down' },
  { key: 'unexplained', label: 'Unexplained absences', good: 'down' },
  { key: 'communicated', label: 'Absences and lates communicated by email', good: 'none' },
  { key: 'lateMarks', label: 'Late marks', good: 'down' },
  { key: 'latesBeyond', label: 'Late marks beyond the allowance', good: 'down' },
  { key: 'earlyDepartures', label: 'Early departures', good: 'down' },
  { key: 'missingPunches', label: 'Missing punches', good: 'down' },
  { key: 'offDaysWorked', label: 'Days worked on a weekly off or holiday', good: 'none' },
];

/** Per-person figures for the month, for the people tables. */
export function personFigures(d: MonthData, id: string) {
  const days = Object.values(d.records[id] ?? {});
  let present = 0, workdays = 0, leave = 0, minutes = 0, worked = 0, firstIn = 0, ins = 0;
  for (const x of days) {
    if (x.code === 'P') present++;
    if (x.code === 'HD') present += 0.5;
    if (x.code === 'LV') leave++;
    if (['P', 'HD', 'A', 'NR'].includes(x.code)) workdays++;
    if ((x.code === 'P' || x.code === 'HD') && x.minutesWorked) { minutes += x.minutesWorked; worked++; }
    if ((x.code === 'P' || x.code === 'HD') && x.login != null) { firstIn += x.login; ins++; }
  }
  const mine = d.issues.filter((x) => x.employeeId === id && x.state !== 'system');
  return {
    presentRate: workdays ? Math.round((present / workdays) * 1000) / 10 : 0,
    leaveDays: leave,
    avgMinutes: worked ? Math.round(minutes / worked) : 0,
    avgLogin: ins ? Math.round(firstIn / ins) : null,
    lates: mine.filter((x) => x.type === 'Late arrival').length,
    early: mine.filter((x) => x.type === 'Early departure').length,
    unexplained: d.issues.filter((x) => x.employeeId === id && isUnexplained(x)).length,
    communicated: mine.filter((x) => x.state === 'explained' || x.state === 'unclear').length,
  };
}
