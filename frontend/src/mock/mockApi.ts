import type { AttendanceApi } from '../api/client';
import type { ChangeEntry, Holiday, MonthData, Settings, TrendPoint } from '../types';
import { isUnexplained, totals } from '../lib/stats';
import { hm } from '../lib/format';
import { DEFAULT_SETTINGS, EMPLOYEES, HOLIDAYS, MONTHS, OFFICES, TODAY } from './seed';
import { simulateMonth } from './simulate';

// Demo-only persistence: settings live in this browser so the demo remembers them.
const KEY = 'attendance-desk-demo-v1';
interface Stored { settings: Settings; holidays: Holiday[]; settingChanges: ChangeEntry[] }

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch { /* storage blocked: fall back to defaults */ }
  return { settings: DEFAULT_SETTINGS, holidays: HOLIDAYS, settingChanges: [] };
}
function save(s: Stored) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* not saved, demo still works */ }
}

let state = load();
let cache: Record<string, MonthData> = {};
const month = (m: string) => (cache[m] ??= simulateMonth({ month: m, settings: state.settings, holidays: state.holidays, settingChanges: state.settingChanges }));
const nowStamp = () => `${TODAY}T${new Date().toTimeString().slice(0, 5)}`;
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));

function describe(a: Settings, b: Settings): string[] {
  const out: string[] = [];
  const num: [keyof Settings, string, string][] = [
    ['graceMinutes', 'Late grace period', 'min'], ['earlyToleranceMinutes', 'Early departure tolerance', 'min'],
    ['shortHoursToleranceMinutes', 'Short hours tolerance', 'min'], ['halfDayBelowHours', 'Half day below', 'h'],
    ['duplicatePunchLimit', 'Duplicate punch limit', ''], ['systemIssueMinPeople', 'Likely system issue from', 'people'],
    ['autoApplyConfidence', 'Apply emails at confidence', '%'], ['reminderAfterDays', 'Reminder after', 'working days'],
    ['closeDay', 'Month closes on day', ''], ['hrDigestTime', 'HR daily summary time', ''],
  ];
  for (const [k, label, unit] of num) if (a[k] !== b[k]) out.push(`${label}: ${a[k]} → ${b[k]}${unit ? ' ' + unit : ''}`);
  if (a.remindersOn !== b.remindersOn) out.push(`Employee reminders: ${a.remindersOn ? 'on' : 'off'} → ${b.remindersOn ? 'on' : 'off'}`);
  if (a.reportRecipients.join() !== b.reportRecipients.join()) out.push(`Report recipients: ${b.reportRecipients.join(', ') || 'none'}`);
  if (a.weeklyOff.join() !== b.weeklyOff.join()) out.push('Weekly off days changed');
  for (const o of OFFICES) {
    const x = a.shifts[o.id], y = b.shifts[o.id];
    if (x.start !== y.start || x.end !== y.end) out.push(`${o.name} shift: ${hm(x.start)}–${hm(x.end)} → ${hm(y.start)}–${hm(y.end)}`);
  }
  return out;
}

function logSetting(from: string, to: string, reason: string) {
  state.settingChanges.push({ id: `S${Date.now()}${state.settingChanges.length}`, at: nowStamp(), subject: 'Rules and settings', from, to, reason, source: 'Settings' });
}

export const mockApi: AttendanceApi = {
  getReference: () => wait({ offices: OFFICES, employees: EMPLOYEES, holidays: state.holidays, settings: state.settings, today: TODAY, months: MONTHS }),
  getMonth: (m) => wait(month(m)),
  getTrend: () => wait(MONTHS.map((m): TrendPoint => {
    const d = month(m);
    const all = Object.values(d.records).flatMap((r) => Object.values(r));
    return {
      month: m,
      issues: d.issues.filter((x) => x.state !== 'system').length,
      unexplained: d.issues.filter(isUnexplained).length,
      lates: d.issues.filter((x) => x.type === 'Late arrival' && x.state !== 'explained').length,
      presentRate: totals(all).rate,
    };
  })),
  async saveSettings(next) {
    for (const line of describe(state.settings, next)) logSetting(line.split(':')[0], line.split(': ').slice(1).join(': '), 'Changed on the Rules page. All months were re-checked with the new value.');
    state = { ...state, settings: next };
    save(state);
    cache = {};
    return wait(undefined);
  },
  async saveHolidays(holidays) {
    const added = holidays.filter((h) => !state.holidays.some((x) => x.date === h.date && x.calendar === h.calendar));
    const removed = state.holidays.filter((h) => !holidays.some((x) => x.date === h.date && x.calendar === h.calendar));
    for (const h of added) logSetting('Holiday calendar', `Added ${h.name} (${h.date}, ${h.calendar})`, 'Added on the Rules page.');
    for (const h of removed) logSetting('Holiday calendar', `Removed ${h.name} (${h.date}, ${h.calendar})`, 'Removed on the Rules page.');
    state = { ...state, holidays };
    save(state);
    cache = {};
    return wait(undefined);
  },
};

export function resetDemo() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  state = { settings: DEFAULT_SETTINGS, holidays: HOLIDAYS, settingChanges: [] };
  cache = {};
}
