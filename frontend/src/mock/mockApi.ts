import type { AttendanceApi } from '../api/client';
import type { ChangeEntry, Employee, Holiday, MonthData, Settings, Shift, TrendPoint, User } from '../types';
import { isUnexplained, totals } from '../lib/stats';
import { hm } from '../lib/format';
import { CALENDARS, DEFAULT_SETTINGS, EMPLOYEES, HOLIDAYS, MONTHS, OFFICES, SHIFTS, TODAY } from './seed';
import { simulateMonth } from './simulate';

// Demo only: changes live in this browser so the demo remembers them. Nothing is sent anywhere.
const KEY = 'attendance-desk-demo-v2';
interface Stored { settings: Settings; holidays: Holiday[]; shifts: Shift[]; employees: Employee[]; settingChanges: ChangeEntry[] }

const fresh = (): Stored => ({ settings: DEFAULT_SETTINGS, holidays: HOLIDAYS, shifts: SHIFTS, employees: EMPLOYEES, settingChanges: [] });
function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...(JSON.parse(raw) as Partial<Stored>) };
  } catch { /* storage blocked: fall back to defaults */ }
  return fresh();
}
function save(s: Stored) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* not saved, demo still works */ }
}

const DEMO_USER: User = { id: 1, email: 'you@example.com', name: 'Demo user', role: 'admin' };
let state = load();
let cache: Record<string, MonthData> = {};
const month = (m: string) => (cache[m] ??= simulateMonth({ month: m, settings: state.settings, holidays: state.holidays, settingChanges: state.settingChanges, shifts: state.shifts, employees: state.employees }));
const nowStamp = () => `${TODAY}T${new Date().toTimeString().slice(0, 5)}`;
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));
const changed = () => { save(state); cache = {}; };

function log(from: string, to: string, reason: string, source: ChangeEntry['source'] = 'Settings', employeeId: string | null = null) {
  state.settingChanges.push({ id: `S${Date.now()}${state.settingChanges.length}`, at: nowStamp(), employeeId, subject: employeeId ? null : 'Rules and settings', from, to, reason, source });
}

export const mockApi: AttendanceApi = {
  session: () => wait({ user: DEMO_USER, needsSetup: false }),
  setup: () => wait(DEMO_USER),
  login: () => wait(DEMO_USER),
  logout: () => wait(undefined),

  getReference: () => wait({ offices: OFFICES, employees: state.employees, holidays: state.holidays, calendars: CALENDARS, shifts: state.shifts, settings: state.settings, today: TODAY, months: MONTHS, user: DEMO_USER }),
  getMonth: (m) => wait(month(m)),
  getTrend: () => wait(MONTHS.map((m): TrendPoint => {
    const d = month(m);
    return {
      month: m,
      issues: d.issues.filter((x) => x.state !== 'system').length,
      unexplained: d.issues.filter(isUnexplained).length,
      lates: d.issues.filter((x) => x.type === 'Late arrival' && x.state !== 'explained').length,
      presentRate: totals(Object.values(d.records).flatMap((r) => Object.values(r))).rate,
    };
  })),
  connections: () => wait({ microsoft: false, claude: false, sendEmail: false, mailbox: 'hr@amipi.com', lastRun: null, lastRunLog: ['This is the demo with sample data. Nothing is connected.'] }),
  listImports: () => wait(MONTHS.map((m, i) => ({ id: i + 1, month: m, fileName: `monthdatewiseperformance-${m}.xls`, source: 'upload' as const, importedAt: `${m}-28T10:00`, importedBy: 'Sample data', people: EMPLOYEES.length, days: EMPLOYEES.length * 30 })).reverse()),

  async saveSettings(next) {
    for (const k of Object.keys(next) as (keyof Settings)[]) {
      if (JSON.stringify(state.settings[k]) !== JSON.stringify(next[k])) log(`${k}: ${JSON.stringify(state.settings[k])}`, JSON.stringify(next[k]), 'Changed on the Rules page. Every month was checked again.');
    }
    state = { ...state, settings: next };
    changed();
    return wait(undefined);
  },
  async saveHolidays(holidays) {
    const key = (h: Holiday) => `${h.calendar}|${h.date}|${h.name}`;
    const was = new Set(state.holidays.map(key));
    const now = new Set(holidays.map(key));
    for (const h of holidays) if (!was.has(key(h))) log('Holiday calendar', `Added ${h.name} (${h.date}, ${h.calendar})`, 'Added on the Rules page.');
    for (const h of state.holidays) if (!now.has(key(h))) log(`${h.name} (${h.date}, ${h.calendar})`, 'Removed', 'Removed on the Rules page.');
    state = { ...state, holidays };
    changed();
    return wait(undefined);
  },
  async saveShifts(shifts) {
    for (const s of shifts) {
      const old = state.shifts.find((x) => x.code === s.code);
      if (old && (old.start !== s.start || old.end !== s.end)) log(`Shift ${s.code}: ${hm(old.start)}–${hm(old.end)}`, `${hm(s.start)}–${hm(s.end)}`, 'Changed on the Rules page.');
    }
    state = { ...state, shifts };
    changed();
    return wait(undefined);
  },
  async saveEmployee(id, changes) {
    const old = state.employees.find((e) => e.id === id);
    if (old) {
      for (const k of Object.keys(changes) as (keyof Employee)[]) {
        if ((old[k] ?? '') !== (changes[k] ?? '')) log(`${old.name}: ${k} ${old[k] || 'empty'}`, String(changes[k] || 'empty'), 'Changed on the People page.', 'People page', id);
      }
    }
    state = { ...state, employees: state.employees.map((e) => (e.id === id ? { ...e, ...changes } : e)) };
    changed();
    return wait(undefined);
  },
  uploadImport: async () => { throw new Error('Uploads are not available in the demo. They work on the real server.'); },
  buildPackage: async () => { throw new Error('In the demo the package is not built. On the real server it is saved and emailed.'); },
  runJobs: () => wait(['This is the demo. On the real server this reads hr@, sends reminders and closes months.']),
  listUsers: () => wait([DEMO_USER]),
  addUser: async () => { throw new Error('Users can only be added on the real server.'); },
  removeUser: async () => { throw new Error('Users can only be removed on the real server.'); },
  exportUrl: () => null,
  reportUrl: () => null,
};

export function resetDemo() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  state = fresh();
  cache = {};
}
