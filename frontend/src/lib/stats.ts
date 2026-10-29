import type { DayRecord, Issue, IssueState } from '../types';

export interface DayTotals {
  present: number;
  absent: number;
  leave: number;
  holiday: number;
  weeklyOff: number;
  noRecord: number;
  workdays: number;
  minutes: number;
  rate: number;
}

/** Totals for a set of day records. Half days count 0.5 present and 0.5 absent, as in the current exports. */
export function totals(days: DayRecord[]): DayTotals {
  const t = { present: 0, absent: 0, leave: 0, holiday: 0, weeklyOff: 0, noRecord: 0, workdays: 0, minutes: 0, rate: 0 };
  for (const d of days) {
    if (d.code === 'P') t.present++;
    if (d.code === 'HD') { t.present += 0.5; t.absent += 0.5; }
    if (d.code === 'A') t.absent++;
    if (d.code === 'LV') t.leave++;
    if (d.code === 'HL') t.holiday++;
    if (d.code === 'WO') t.weeklyOff++;
    if (d.code === 'NR') t.noRecord++;
    if (['P', 'HD', 'A', 'NR'].includes(d.code)) t.workdays++;
    t.minutes += d.minutesWorked ?? 0;
  }
  t.rate = t.workdays ? (t.present / t.workdays) * 100 : 0;
  return t;
}

export const ATTENTION: IssueState[] = ['open', 'reminded', 'unclear'];
export const needsAttention = (x: Issue) => ATTENTION.includes(x.state);
/** Absences with no word from the person. "Communicated, unclear" ones are not counted. */
export const isUnexplained = (x: Issue) => (x.type === 'Unexplained absence' || x.type === 'Long absence') && (x.state === 'open' || x.state === 'reminded');
