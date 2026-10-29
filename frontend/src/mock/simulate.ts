// Stands in for the backend in the demo. It builds raw punches from the sample data, then runs the same
// automatic steps the real backend will run: apply calendars and the employee list, read HR emails,
// check the rules, group likely system faults, send reminders, take in late data and close the month.
import type {
  ChangeEntry, DayRecord, Employee, Holiday, HrEmail, Issue, IssueType, MonthData, Notification,
  Office, Settings, Severity, SourceHealth,
} from '../types';
import { addDays, dayOfWeek, fmtDay, fmtMonth, fmtShort, hm, monthDates, nextMonth, dur, plural } from '../lib/format';
import { EMPLOYEES, LATE_FIXES, OCT_EMAILS, OCT_PLANTS, OFFICES, TODAY, type Plant, type SeedEmail } from './seed';

const NOTIFY_TYPES: IssueType[] = ['Missing punch-in', 'Missing punch-out', 'Missing record', 'Unexplained absence'];

function rng(seedText: string) {
  let a = 0;
  for (let i = 0; i < seedText.length; i++) a = (Math.imul(31, a) + seedText.charCodeAt(i)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

export interface SimInput {
  month: string;
  settings: Settings;
  holidays: Holiday[];
  settingChanges: ChangeEntry[];
}

export function simulateMonth({ month, settings, holidays, settingChanges }: SimInput): MonthData {
  const dates = monthDates(month);
  const last = dates[dates.length - 1];
  const dataThrough = last < TODAY ? last : addDays(TODAY, -1);
  const isOct = month === '2026-10';
  const office = (id: string) => OFFICES.find((o) => o.id === id) as Office;
  const holidayOn = (date: string, cal: string) => holidays.find((h) => h.date === date && h.calendar === cal);
  const employees = EMPLOYEES.filter((e) => e.joinDate <= last && (!e.exitDate || e.exitDate >= dates[0]));

  const records: MonthData['records'] = {};
  const changes: ChangeEntry[] = [];
  const notifications: Notification[] = [];
  const emails: HrEmail[] = [];
  const issues: Issue[] = [];
  let changeN = 0;
  let noteN = 0;
  const addChange = (c: Omit<ChangeEntry, 'id'>) => changes.push({ id: `${month}-C${++changeN}`, ...c });
  const notify = (n: Omit<Notification, 'id'>) => notifications.push({ id: `${month}-N${++noteN}`, ...n });

  // 1. Raw data as the attendance systems send it, plus the calendar and employee-list fixes.
  const holidayHits: Record<string, { name: string; cal: string; n: number }> = {};
  for (const e of employees) {
    const o = office(e.officeId);
    const shift = settings.shifts[o.id] ?? { start: o.shiftStart, end: o.shiftEnd };
    const plants = isOct ? OCT_PLANTS[e.id] ?? {} : {};
    let notEmployed = 0;
    records[e.id] = {};
    for (const date of dates) {
      const r = rng(e.id + date);
      const rec: DayRecord = { employeeId: e.id, date, code: 'P', scheduledStart: shift.start, scheduledEnd: shift.end };
      records[e.id][date] = rec;
      const working = !settings.weeklyOff.includes(dayOfWeek(date));
      const hol = holidayOn(date, o.calendar);
      if (date > dataThrough) { rec.code = 'F'; continue; }
      if (date < e.joinDate || (e.exitDate && date > e.exitDate)) {
        rec.code = 'NE';
        if (working && !hol) { rec.original = { code: 'A' }; notEmployed++; }
        continue;
      }
      if (!working) { rec.code = 'WO'; continue; }
      if (hol) {
        rec.code = 'HL'; rec.note = hol.name; rec.original = { code: 'A' };
        const k = `${date}|${o.calendar}`;
        holidayHits[k] = { name: hol.name, cal: o.calendar, n: (holidayHits[k]?.n ?? 0) + 1 };
        continue;
      }
      let plant: Plant | undefined = plants[Number(date.slice(8))];
      if (!isOct) {
        const x = r();
        const lateP = e.id === 'E101' ? 0.12 : 0.035;
        if (x < 0.025) plant = 'abs';
        else if (x < 0.025 + lateP) plant = 'late';
        else if (x < 0.035 + lateP) plant = 'missout';
        else if (x < 0.04 + lateP) plant = 'short';
        else if (x < 0.045 + lateP) plant = 'early';
      }
      if (plant === 'abs') { rec.code = 'A'; continue; }
      if (plant === 'norec') { rec.code = 'NR'; continue; }
      const login = shift.start + between(r, -25, 12);
      rec.login = login;
      rec.logout = shift.end + between(r, -8, 45);
      rec.punches = 2;
      if (plant === 'late') rec.login = shift.start + between(r, 38, 62);
      if (plant === 'missout') rec.logout = null;
      if (plant === 'missin') rec.login = null;
      if (plant === 'short') rec.logout = login + 312;
      if (plant === 'half') rec.logout = login + 250;
      if (plant === 'early') rec.logout = shift.end - 120;
      if (plant === 'dup') rec.punches = 4;
      if (plant === 'zero') rec.logout = rec.login;
      if (plant === 'odd') { rec.login = 160; rec.logout = 700; }
      if (rec.login != null && rec.logout != null) {
        rec.minutesWorked = rec.logout - rec.login;
        if (rec.minutesWorked > 0 && rec.minutesWorked < settings.halfDayBelowHours * 60) rec.code = 'HD';
      }
    }
    if (notEmployed) {
      const joined = e.joinDate >= dates[0];
      addChange({
        at: `${joined ? e.joinDate : addDays(e.exitDate as string, 1)}T06:00`, employeeId: e.id,
        from: `Absent (${plural(notEmployed, 'working day')})`, to: 'Not employed',
        reason: joined ? `Joined on ${fmtShort(e.joinDate)}. Days before joining are not absences.` : `Left on ${fmtShort(e.exitDate as string)}. Days after leaving are not absences.`,
        source: 'Employee list',
      });
    }
  }
  for (const [k, h] of Object.entries(holidayHits)) {
    const date = k.split('|')[0];
    addChange({
      at: `${date}T00:05`, subject: `All ${h.cal === 'IN' ? 'India' : 'New York'} staff (${h.n})`, date,
      from: 'Absent', to: `Holiday: ${h.name}`,
      reason: `${h.name} is on the ${h.cal === 'IN' ? 'India' : 'US'} holiday calendar. The device does not know holidays, so it sent these days as absent.`,
      source: 'Holiday calendar',
    });
  }

  // 2. HR emails: apply confident matches, keep unclear ones as "communicated".
  const seedEmails = isOct ? OCT_EMAILS : syntheticEmails(month, employees, records);
  const explains: Record<string, { emailId: string; covers: string; applied: boolean }> = {};
  for (const m of seedEmails) {
    const emp = employees.find((e) => e.id === m.employeeId);
    if (!emp || !m.covers) {
      emails.push({ ...m, outcome: 'not-attendance', action: 'Not about attendance. Left in the mailbox, nothing changed.' });
      continue;
    }
    const applied = m.confidence >= settings.autoApplyConfidence;
    const dayList = m.dates.map(fmtShort).join(', ');
    for (const d of m.dates) explains[`${emp.id}|${d}`] = { emailId: m.id, covers: m.covers, applied };
    let action: string;
    if (!applied) {
      action = `Match confidence ${m.confidence}% is below ${settings.autoApplyConfidence}%. ${emp.name} on ${dayList} kept as absent and marked "Communicated, unclear".`;
    } else if (m.covers === 'absence') {
      const leave = m.leaveType ?? 'Other leave';
      for (const d of m.dates) {
        const rec = records[emp.id]?.[d];
        if (!rec || rec.code !== 'A') continue;
        rec.original = { code: 'A' };
        rec.code = 'LV';
        rec.leaveType = leave;
        addChange({ at: laterOf(m.receivedAt, `${addDays(d, 1)}T06:00`), employeeId: emp.id, date: d, from: 'Absent', to: leave, reason: `Email "${m.subject}" from ${m.from}`, source: 'HR email', emailId: m.id });
      }
      action = `Marked ${emp.name} as ${leave.toLowerCase()} on ${dayList}.`;
    } else {
      action = `Linked to ${emp.name}'s ${m.covers === 'late' ? 'late arrival' : 'early departure'} on ${dayList}. Marked as explained.`;
    }
    emails.push({ ...m, outcome: applied ? 'applied' : 'unclear', action });
  }

  // 3. Rule checks.
  const g = settings;
  let issueN = 0;
  for (const e of employees) {
    const o = office(e.officeId);
    for (const date of dates) {
      const rec = records[e.id][date];
      if (date > dataThrough) break;
      const add = (type: IssueType, severity: Severity, detail: string) => {
        const x: Issue = { id: `${month}-X${++issueN}`, employeeId: e.id, date, type, severity, state: 'open', detail, timeline: [{ at: `${addDays(date, 1)}T06:00`, text: 'Found by the daily check' }] };
        const ex = explains[`${e.id}|${date}`];
        const matches = ex && ((ex.covers === 'absence' && type === 'Unexplained absence') || (ex.covers === 'late' && type === 'Late arrival') || (ex.covers === 'early' && type === 'Early departure'));
        if (ex && matches) {
          const m = emails.find((em) => em.id === ex.emailId) as HrEmail;
          x.emailId = m.id;
          x.state = ex.applied ? 'explained' : 'unclear';
          if (!ex.applied && type === 'Unexplained absence') x.detail = 'No punches and no leave on record. An email arrived but could not be matched with confidence.';
          x.timeline.push({ at: laterOf(m.receivedAt, x.timeline[0].at), text: ex.applied ? `Explained by email "${m.subject}"` : `Email "${m.subject}" may be about this, but the match is unclear (${m.confidence}%). Kept as communicated, unclear.` });
        }
        issues.push(x);
      };
      const s = rec.scheduledStart as number;
      const end = rec.scheduledEnd as number;
      if (rec.code === 'A') add('Unexplained absence', 'high', 'No punches, no leave on record and no email about this day.');
      if (rec.code === 'NR') add('Missing record', 'medium', `Nothing arrived from ${o.source} for this working day. This is different from an absence.`);
      if (rec.code !== 'P' && rec.code !== 'HD') continue;
      if (rec.login == null && rec.logout != null) add('Missing punch-in', 'medium', `Punch-out at ${hm(rec.logout)} but no punch-in.`);
      if (rec.login != null && rec.logout == null) add('Missing punch-out', 'medium', `Punch-in at ${hm(rec.login)} but no punch-out.`);
      if (rec.login != null && rec.login > s + g.graceMinutes && rec.login < s + 240) {
        const late = rec.login - s;
        add('Late arrival', late > 60 ? 'medium' : 'low', `In at ${hm(rec.login)}, shift starts ${hm(s)}. ${late} min late (grace is ${g.graceMinutes} min).`);
      }
      const early = rec.logout != null && rec.login != null && rec.logout < end - g.earlyToleranceMinutes && rec.logout > rec.login;
      if (early) add('Early departure', 'low', `Out at ${hm(rec.logout)}, shift ends ${hm(end)}.`);
      const worked = rec.minutesWorked;
      if (worked === 0) add('Zero hours', 'medium', `Punch-in and punch-out are both ${hm(rec.login)}, so hours show as zero.`);
      else if (worked != null && !early && worked < end - s - g.shortHoursToleranceMinutes) {
        add('Short hours', rec.code === 'HD' ? 'low' : 'medium', `Worked ${dur(worked)} of ${dur(end - s)} scheduled.${rec.code === 'HD' ? ' Counted as a half day.' : ''}`);
      }
      if ((rec.punches ?? 0) > g.duplicatePunchLimit) add('Duplicate punches', 'low', `${rec.punches} punches within 2 minutes of each other. Only the first and last were used.`);
      if (rec.login != null && (rec.login < s - 180 || rec.login > s + 240)) add('Unusual login time', 'medium', `Login at ${hm(rec.login)} ${o.tzLabel} is far from the usual start of ${hm(s)}.`);
    }
  }

  // 4. Same problem for many people in one office on one day: likely a device or sync fault.
  const groups: Record<string, Issue[]> = {};
  for (const x of issues) {
    if (x.type !== 'Missing punch-out' && x.type !== 'Missing punch-in' && x.type !== 'Missing record') continue;
    const k = `${EMPLOYEES.find((e) => e.id === x.employeeId)?.officeId}|${x.date}|${x.type}`;
    (groups[k] ??= []).push(x);
  }
  for (const [k, list] of Object.entries(groups)) {
    if (list.length < g.systemIssueMinPeople) continue;
    const [officeId, date, type] = k.split('|');
    const o = office(officeId);
    for (const x of list) {
      x.state = 'system';
      x.severity = 'low';
      x.detail += ` ${list.length} people at ${o.name} have the same gap on this day, which points to a device or sync problem.`;
      x.timeline.push({ at: `${addDays(date, 1)}T06:01`, text: `Grouped with ${list.length - 1} similar cases. Not counted against the employee.` });
    }
    notify({ at: `${addDays(date, 1)}T06:05`, to: 'hr@amipi.com', audience: 'HR', subject: `Likely device problem: ${type.toLowerCase()} for ${list.length} people at ${o.name} on ${fmtDay(date)}`, issueIds: list.map((x) => x.id) });
  }

  // 5. Reminders to employees, then late data that fixes earlier gaps.
  if (g.remindersOn) {
    for (const x of issues) {
      if (x.state !== 'open' || !NOTIFY_TYPES.includes(x.type)) continue;
      const day = nextWorkingDay(x.date, g.reminderAfterDays, g.weeklyOff);
      if (day > TODAY) continue;
      const emp = EMPLOYEES.find((e) => e.id === x.employeeId) as Employee;
      const at = `${day}T10:00`;
      const ask = x.type === 'Unexplained absence' ? 'please reply with the reason for your absence' : 'please reply with your actual time';
      notify({ at, to: emp.email, audience: 'Employee', subject: `Please check your attendance for ${fmtDay(x.date)} (${x.type.toLowerCase()}): ${ask}`, issueIds: [x.id] });
      x.state = 'reminded';
      x.timeline.push({ at, text: `Reminder emailed to ${emp.email}` });
    }
  }
  if (isOct) {
    for (const f of LATE_FIXES) {
      const rec = records[f.employeeId]?.[f.date];
      if (!rec) continue;
      rec.original = { code: rec.code, login: rec.login, logout: rec.logout };
      rec[f.field] = f.value;
      if (rec.login != null && rec.logout != null) rec.minutesWorked = rec.logout - rec.login;
      const x = issues.find((i) => i.employeeId === f.employeeId && i.date === f.date && i.type === (f.field === 'logout' ? 'Missing punch-out' : 'Missing punch-in'));
      if (x) { x.state = 'fixed'; x.timeline.push({ at: f.at, text: `${f.field === 'logout' ? 'Punch-out' : 'Punch-in'} of ${hm(f.value)} arrived late from the device. Fixed.` }); }
      addChange({ at: f.at, employeeId: f.employeeId, date: f.date, from: `${f.field === 'logout' ? 'Punch-out' : 'Punch-in'} missing`, to: hm(f.value), reason: 'The device sent this punch a day late. Taken as sent.', source: 'Late data' });
    }
  }

  // 6. Daily summary to HR (information only; nothing waits on HR).
  for (const date of dates) {
    if (date > dataThrough || g.weeklyOff.includes(dayOfWeek(addDays(date, 1)))) continue;
    const upto = issues.filter((x) => x.date <= date);
    const open = upto.filter((x) => x.state === 'open' || x.state === 'reminded' || x.state === 'unclear').length;
    const newToday = upto.filter((x) => x.date === date).length;
    notify({ at: `${addDays(date, 1)}T${g.hrDigestTime}`, to: 'hr@amipi.com', audience: 'HR', subject: `Daily summary for ${fmtDay(date)}: ${plural(newToday, 'new item')}, ${open} still need attention`, issueIds: [] });
  }

  // 7. Month close: automatic, on the set day.
  const closeDate = `${nextMonth(month)}-${String(g.closeDay).padStart(2, '0')}`;
  const closed = closeDate <= TODAY;
  if (closed) {
    for (const to of g.reportRecipients) {
      notify({ at: `${closeDate}T06:30`, to, audience: 'Management', subject: `${fmtMonth(month)} attendance package: master file, issues report, summary`, issueIds: [] });
    }
  }
  for (const c of settingChanges) if (c.at.slice(0, 7) === month) changes.push(c);

  changes.sort((a, b) => b.at.localeCompare(a.at));
  notifications.sort((a, b) => b.at.localeCompare(a.at));
  emails.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  const sources: SourceHealth[] = OFFICES.map((o) => {
    const fault = isOct && o.id === 'mumbai';
    return {
      name: o.source, officeId: o.id, ok: !fault,
      lastSync: closed ? `${closeDate}T06:00` : `${TODAY}T06:00`,
      note: fault ? 'Missing punch-outs from 4 people on Wed 14 Oct. Device may have lost power.' : `Data received up to ${fmtDay(dataThrough)}`,
    };
  });

  return {
    month, dataThrough, records, issues, emails, changes, notifications, sources,
    close: { month, closesAt: `${closeDate}T06:00`, closed, reportsSentTo: closed ? g.reportRecipients : [] },
  };
}

function laterOf(a: string, b: string) {
  return a > b ? a : b;
}

function nextWorkingDay(date: string, after: number, weeklyOff: number[]) {
  let d = date;
  let n = 0;
  while (n < after) {
    d = addDays(d, 1);
    if (!weeklyOff.includes(dayOfWeek(d))) n++;
  }
  return d;
}

const TEMPLATES = [
  { subject: 'Sick today', body: 'Hi, I am not well today and will not be able to log in. Will update tomorrow.', leave: 'Sick leave' as const },
  { subject: 'Leave today', body: 'I need to take leave today for a personal matter. Sorry for the short notice.', leave: 'Planned leave' as const },
  { subject: 'Not coming in', body: 'Not feeling well since last night. Taking the day off.', leave: 'Sick leave' as const },
];

/** Emails for past months: most absences got an email, a few were unclear. */
function syntheticEmails(month: string, employees: Employee[], records: MonthData['records']): SeedEmail[] {
  const out: SeedEmail[] = [];
  for (const e of employees) {
    for (const [date, rec] of Object.entries(records[e.id])) {
      if (rec.code !== 'A') continue;
      const r = rng(`mail${e.id}${date}`);
      const x = r();
      if (x > 0.75) continue;
      const t = TEMPLATES[Math.floor(r() * TEMPLATES.length)];
      const unclear = x < 0.1;
      out.push({
        id: `${month}-M${out.length + 1}`, from: unclear ? `${e.name.split(' ')[0].toLowerCase()}.home@example.net` : e.email,
        receivedAt: `${date}T0${between(r, 7, 9)}:${String(between(r, 10, 59))}`, subject: t.subject, body: t.body,
        detected: t.leave, employeeId: e.id, dates: [date], confidence: unclear ? between(r, 55, 75) : between(r, 86, 98),
        leaveType: t.leave, covers: 'absence', warning: unclear ? 'Sent from a personal address with no name in it.' : undefined,
      });
    }
  }
  return out;
}
