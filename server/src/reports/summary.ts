// The numbers and sentences for the management summary. Same rules as the Monthly report screen.
import type { DayRecord, Employee, Issue, MonthData } from '../../../shared/types.ts';
import { day, monthName } from '../engine/dates.ts';

export function totals(days: DayRecord[]) {
  const t = { present: 0, absent: 0, leave: 0, holiday: 0, weeklyOff: 0, workdays: 0, minutes: 0, rate: 0 };
  for (const d of days) {
    if (d.code === 'P') t.present++;
    if (d.code === 'HD') { t.present += 0.5; t.absent += 0.5; }
    if (d.code === 'A') t.absent++;
    if (d.code === 'LV') t.leave++;
    if (d.code === 'HL') t.holiday++;
    if (d.code === 'WO') t.weeklyOff++;
    if (['P', 'HD', 'A', 'NR'].includes(d.code)) t.workdays++;
    t.minutes += d.minutesWorked ?? 0;
  }
  t.rate = t.workdays ? Math.round((t.present / t.workdays) * 1000) / 10 : 0;
  return t;
}

export const needsAttention = (x: Issue) => ['open', 'reminded', 'unclear'].includes(x.state);
export const isUnexplained = (x: Issue) => (x.type === 'Unexplained absence' || x.type === 'Long absence') && (x.state === 'open' || x.state === 'reminded');

/** People with any late mark beyond their office's allowance, 2+ unexplained absences or 2+ missing punches. */
export function patterns(issues: Issue[]) {
  const by: Record<string, { lates: number; unexplained: number; punches: number }> = {};
  for (const x of issues) {
    if (['explained', 'system', 'fixed', 'allowed'].includes(x.state)) continue;
    const p = (by[x.employeeId] ??= { lates: 0, unexplained: 0, punches: 0 });
    if (x.type === 'Late arrival') p.lates++;
    if (isUnexplained(x)) p.unexplained++;
    if (['Missing punch-in', 'Missing punch-out', 'Missing record'].includes(x.type)) p.punches++;
  }
  return Object.fromEntries(Object.entries(by).filter(([, p]) => p.lates >= 1 || p.unexplained >= 2 || p.punches >= 2));
}

export function summaryLines(data: MonthData, emps: Record<string, Employee>): string[] {
  const t = totals(Object.values(data.records).flatMap((r) => Object.values(r)));
  const attention = data.issues.filter(needsAttention);
  const applied = data.emails.filter((m) => m.outcome === 'applied').length;
  const unclear = data.emails.filter((m) => m.outcome === 'unclear').length;
  const pats = patterns(data.issues);
  const people = Object.keys(data.records).length;
  const lines = [
    ...(data.partial && !data.close.closed ? [`${monthName(data.month)} is still in progress. These figures cover up to ${day(data.dataThrough)}; later days are not counted yet.`] : []),
    `${monthName(data.month)}: present rate ${t.rate}% across ${people} people. Leave, holidays and weekly offs are left out of the rate.`,
    `${data.issues.length} items found. The tool handled ${data.issues.length - attention.length} by itself (emails, later data, likely system issues). ${attention.length} still need attention.`,
    `${applied} HR ${applied === 1 ? 'email' : 'emails'} applied automatically, ${unclear} kept as communicated but unclear.`,
    `${data.issues.filter(isUnexplained).length} unexplained absences. ${data.issues.filter((x) => x.type === 'Late arrival' && x.state !== 'system').length} late marks, of which ${data.issues.filter((x) => x.type === 'Late arrival' && x.state === 'open').length} are beyond the monthly allowance.`,
  ];
  const offDays = Object.values(data.records).flatMap((r) => Object.values(r)).filter((d) => d.note?.startsWith('Worked on a')).length;
  if (offDays) lines.push(`${offDays} days were worked on a weekly off or holiday (paid extra under the attendance rules).`);
  const names = Object.keys(pats).map((id) => emps[id]?.name ?? id);
  if (names.length) lines.push(`${names.length} people show a repeat pattern: ${names.join(', ')}.`);
  for (const x of data.issues) if (x.type === 'Long absence' && needsAttention(x)) lines.push(`${emps[x.employeeId]?.name ?? x.employeeId}: ${x.detail}`);
  const sys = data.issues.filter((x) => x.state === 'system').length;
  if (sys) lines.push(`${sys} missing punches look like device or sync problems and were not counted against anyone.`);
  return lines;
}
