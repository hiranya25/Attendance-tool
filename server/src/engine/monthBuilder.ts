// Builds one month from the raw punch rows. Nothing is stored here: the result is recomputed from the
// untouched raw data every time, so a rule change or a new email applies to every month at once.
//
// Steps: employee list (joiners/leavers) -> holiday calendars -> HR emails -> rule checks ->
// long absences -> likely system issues -> reminders already sent -> late data -> logged changes.
import type {
  ChangeEntry, ChangeSource, DayCode, DayRecord, Employee, HrEmail, Issue, IssueType, LeaveType, MonthData,
  Notification, Office, Settings, Severity, Shift, SourceHealth,
} from '../../../shared/types.ts';
import { db } from '../db.ts';
import { now, today } from '../config.ts';
import * as R from '../repo.ts';
import * as D from './dates.ts';

export const LEAVE: Record<string, LeaveType> = { sick_leave: 'Sick leave', planned_leave: 'Planned leave', unpaid_leave: 'Unpaid leave', other_leave: 'Other leave' };
export const NOTIFY_TYPES: IssueType[] = ['Missing punch-in', 'Missing punch-out', 'Unexplained absence'];
const CODE_LABEL: Record<DayCode, string> = { P: 'Present', HD: 'Half day', A: 'Absent', LV: 'Leave', HL: 'Holiday', WO: 'Weekly off', NR: 'No record', NE: 'Not employed', F: 'Upcoming', NT: 'No attendance system' };

export const codeLabel = (c: DayCode) => CODE_LABEL[c] ?? c;
export const issueKey = (emp: string, date: string, type: string) => `${emp}|${date}|${type}`;

type Covers = 'absence' | 'late' | 'early' | 'wfh' | 'punch';
interface Explain { emailId: string; covers: Covers; applied: boolean; subject: string; confidence: number; at: string }
type IssueWithKey = Issue & { key: string };

export function deviceCode(status: string): DayCode {
  switch (status.toUpperCase()) {
    case 'P': return 'P';
    case 'P/2': case 'HD': return 'HD';
    case 'A': return 'A';
    case 'WO': return 'WO';
    case 'HL': case 'H': return 'HL';
    case 'LV': case 'L': return 'LV';
    default: return 'P';
  }
}

export async function buildMonth(month: string): Promise<MonthData> {
  const [rules, employees, shifts, holidays, offices, calendars] = await Promise.all([
    R.getRules(), R.getEmployees(), R.getShifts(), R.getHolidays(), R.getOffices(), R.getCalendars(),
  ]);
  return new Builder(month, rules, employees, shifts, holidays, offices, Object.fromEntries(calendars.map((c) => [c.id, c.name]))).run();
}

class Builder {
  private emps: Record<string, Employee>;
  private shifts: Record<string, Shift>;
  private hol: Record<string, Record<string, string>> = {};
  private offices: Record<string, Office>;
  private changes: ChangeEntry[] = [];
  private issues: IssueWithKey[] = [];
  private changeN = 0;
  private foundAt = '';

  constructor(
    private month: string, private r: Settings, employees: Employee[], shifts: Shift[],
    holidays: { date: string; name: string; calendar: string }[], offices: Office[], private calNames: Record<string, string>,
  ) {
    this.emps = Object.fromEntries(employees.map((e) => [e.id, e]));
    this.shifts = Object.fromEntries(shifts.map((s) => [s.code, s]));
    for (const h of holidays) (this.hol[h.calendar] ??= {})[h.date] = h.name;
    this.offices = Object.fromEntries(offices.map((o) => [o.id, o]));
  }

  async run(): Promise<MonthData> {
    const { month, r } = this;
    const dates = D.monthDates(month);
    const imports = await R.latestImports(month);
    const imp = imports[0];
    // A month-to-date file can list the rest of the month as blank or absent, and today is not over yet.
    // Only days up to yesterday count; later rows are kept in the database but treated as "not yet".
    // Each file (the punch export, the Mumbai sheet) covers its own dates.
    const lastFullDay = D.addDays(today(), -1);
    const raw: R.RawRow[] = [];
    const throughOf: Record<string, string> = {};
    for (const i of imports) {
      const rows = await R.rawDays(i.id);
      const last = rows.reduce((m, x) => (x.date > m ? x.date : m), '');
      const through = last > lastFullDay ? lastFullDay : last;
      for (const row of rows) { raw.push(row); throughOf[row.emp_code] = through; }
    }
    this.foundAt = imports.reduce((m, i) => (i.imported_at > m ? i.imported_at : m), '') || now();
    const monthEnd = dates[dates.length - 1];
    const emailsOnly = Object.values(this.offices).filter((o) => o.mode === 'emails').map((o) => o.id);
    const emailsThrough = month <= today().slice(0, 7) ? (monthEnd < lastFullDay ? monthEnd : lastFullDay) : '';
    const throughs = [...Object.values(throughOf), ...(emailsOnly.length && emailsThrough >= dates[0] ? [emailsThrough] : [])];
    const dataThrough = throughs.length ? throughs.reduce((m, x) => (x > m ? x : m)) : null;
    const partial = monthEnd > (dataThrough ?? '');

    const byEmp: Record<string, Record<string, R.RawRow>> = {};
    for (const row of raw) (byEmp[row.emp_code] ??= {})[row.date] = row;
    // Offices with no attendance system (New York): days come from the calendar and HR emails only.
    if (emailsThrough >= dates[0]) {
      for (const e of Object.values(this.emps)) {
        if (!emailsOnly.includes(e.officeId) || e.tracked === false || byEmp[e.id]) continue;
        byEmp[e.id] = {};
        throughOf[e.id] = emailsThrough;
      }
    }

    // 1. Day records from the raw data, with the employee list and holiday calendars applied.
    const records: Record<string, Record<string, DayRecord>> = {};
    const holidayHits: Record<string, number> = {};
    for (const [code, days] of Object.entries(byEmp)) {
      const e = this.emps[code];
      if (!e || e.tracked === false) continue;
      const cal = this.hol[e.calendarId] ?? {};
      const weeklyOff = this.weeklyOff(e.officeId);
      const through = throughOf[code] ?? '';
      const noSystem = emailsOnly.includes(e.officeId);
      let notEmployed = 0;
      records[code] = {};
      for (const date of dates) {
        const row = date > through ? undefined : days[date];
        if (!row) {
          // No row for this day: only a working day counts as a missing record.
          const pastDay = date <= through;
          const employed = !(e.joinDate && date < e.joinDate) && !(e.exitDate && date > e.exitDate);
          const offDay = weeklyOff.includes(D.dow(date)) ? 'WO' : cal[date] ? 'HL' : null;
          const code_: DayCode = !pastDay ? 'F' : !employed ? 'NE' : offDay ?? (noSystem ? 'NT' : 'NR');
          records[code][date] = { employeeId: code, date, code: code_, ...(code_ === 'HL' ? { note: cal[date] } : {}) };
          continue;
        }
        const dev = deviceCode(row.status);
        const shift = this.shifts[row.shift] ?? this.shifts[e.shiftCode];
        const rec: DayRecord = {
          employeeId: code, date, code: dev, shift: row.shift === 'X' || !row.shift ? null : row.shift,
          login: row.in_min, logout: row.out_min,
          device: { status: row.status, remark: row.remark, workMinutes: row.work_min, lessMinutes: row.less_min },
        };
        if (shift && (dev === 'P' || dev === 'HD' || dev === 'A')) { rec.scheduledStart = shift.start; rec.scheduledEnd = shift.end; }
        if (rec.login != null && rec.logout != null) rec.minutesWorked = D.span(rec.login, rec.logout);

        if ((e.joinDate && date < e.joinDate) || (e.exitDate && date > e.exitDate)) {
          if (dev !== 'WO' && dev !== 'HL') notEmployed++;
          rec.original = { code: dev };
          rec.code = 'NE';
        } else if (cal[date]) {
          if (dev === 'A') {
            rec.original = { code: 'A' };
            const k = `${e.calendarId}|${date}`;
            holidayHits[k] = (holidayHits[k] ?? 0) + 1;
            rec.code = 'HL';
          } else if (dev === 'WO') {
            rec.code = 'HL';
          } else if (dev === 'P' || dev === 'HD') {
            rec.note = `Worked on a holiday (${cal[date]})`;
          }
          if (rec.code === 'HL') rec.note = cal[date];
        } else if ((dev === 'P' || dev === 'HD') && weeklyOff.includes(D.dow(date))) {
          rec.note = 'Worked on a weekly off (paid extra)';
        }
        records[code][date] = rec;
      }
      if (notEmployed) {
        const joined = !!e.joinDate && e.joinDate > dates[0];
        this.change(joined ? `${e.joinDate}T06:00` : this.foundAt, code, null, `Absent (${notEmployed} working days)`, 'Not employed',
          joined ? `Joined on ${D.short(e.joinDate!)}. Days before joining are not absences.` : `Left on ${D.short(e.exitDate!)}. Days after leaving are not absences.`, 'Employee list');
      }
    }
    for (const [k, n] of Object.entries(holidayHits)) {
      const [calId, date] = k.split('|');
      const name = this.hol[calId][date];
      this.change(this.foundAt, null, date, 'Absent', `Holiday: ${name}`,
        `${name} is on the ${this.calNames[calId]} calendar. The punch system sent it as absent for ${n} ${n === 1 ? 'person' : 'people'}.`, 'Holiday calendar', null, `${this.calNames[calId]} staff (${n})`);
    }

    // 2. HR emails: apply confident matches, keep unclear ones as "communicated".
    const emails: HrEmail[] = [];
    const explains: Record<string, Explain[]> = {};
    for (const m of await this.monthEmails()) {
      const mDates = (JSON.parse(m.dates || '[]') as string[]).filter((d) => d.startsWith(month));
      const emp = m.emp_code ? this.emps[m.emp_code] : undefined;
      const base = {
        id: String(m.id), from: m.from_addr, receivedAt: m.received_at, subject: m.subject, body: m.body,
        detected: m.detected || 'Not about attendance', employeeId: emp ? emp.id : null, dates: mDates,
        confidence: Number(m.confidence), warning: m.warning || null,
      };
      if (m.kind === 'attendance_file') {
        emails.push({ ...base, warning: null, ...(m.error ? { outcome: 'unclear', action: m.error } : { outcome: 'applied', action: m.warning || 'Attendance file imported.' }) });
        continue;
      }
      if (m.error) {
        emails.push({ ...base, outcome: 'unclear', action: `Could not be read automatically: ${m.error} It will be tried again.` });
        continue;
      }
      if (!Number(m.is_attendance) || !emp) {
        emails.push({ ...base, outcome: Number(m.is_attendance) ? 'unclear' : 'not-attendance', action: Number(m.is_attendance) ? 'About attendance, but no matching person was found. Nothing changed.' : 'Not about attendance. Nothing changed.' });
        continue;
      }
      const applied = Number(m.confidence) >= r.autoApplyConfidence;
      const covers: Covers = LEAVE[m.kind] ? 'absence' : m.kind === 'late_arrival' ? 'late' : m.kind === 'early_departure' ? 'early' : m.kind === 'work_from_home' ? 'wfh' : m.kind === 'missing_punch' ? 'punch' : 'absence';
      for (const d of mDates) (explains[`${emp.id}|${d}`] ??= []).push({ emailId: base.id, covers, applied, subject: m.subject, confidence: Number(m.confidence), at: m.processed_at });
      const dayList = mDates.map(D.short).join(', ') || 'no date in this month';
      let action: string;
      if (!applied) {
        action = `Match confidence ${m.confidence}% is below ${r.autoApplyConfidence}%. ${emp.name} on ${dayList} kept as it was and marked "Communicated, unclear".`;
      } else if (covers === 'absence') {
        const leave = LEAVE[m.kind] ?? 'Other leave';
        let changed = 0;
        for (const d of mDates) {
          const rec = records[emp.id]?.[d];
          if (!rec || !['A', 'HD', 'NR', 'NT'].includes(rec.code)) continue;
          const from = rec.code;
          rec.original ??= { code: from };
          rec.leaveType = leave;
          if (from === 'HD') rec.note = `Half day, rest is ${leave.toLowerCase()}`;
          else rec.code = 'LV';
          this.change(m.processed_at, emp.id, d, codeLabel(from), from === 'HD' ? `Half day + ${leave.toLowerCase()}` : leave, `Email "${m.subject}" from ${m.from_addr}`, 'HR email', base.id);
          changed++;
        }
        action = changed ? `Marked ${emp.name} as ${leave.toLowerCase()} on ${dayList}.` : `Noted ${emp.name}'s ${leave.toLowerCase()} for ${dayList}. Those days were not absent in the punch data, so nothing changed.`;
      } else {
        const what = { late: 'late arrival', early: 'early departure', wfh: 'work from home', punch: 'missing punch', absence: '' }[covers];
        action = `Linked to ${emp.name}'s ${what} on ${dayList}. Marked as explained.`;
      }
      emails.push({ ...base, outcome: applied ? 'applied' : 'unclear', action });
    }

    // 3. Rule checks on each working day.
    for (const [code, days] of Object.entries(records)) {
      const e = this.emps[code];
      const tz = this.offices[e.officeId]?.tzLabel ?? 'IST';
      let run: string[] = [];
      for (const [date, rec] of Object.entries(days)) {
        if (rec.code === 'A') { run.push(date); continue; }
        if (rec.code !== 'WO' && rec.code !== 'HL') { this.absenceRun(code, run, explains); run = []; }
        if (rec.code === 'NR') this.issue(code, date, 'Missing record', 'medium', 'No row arrived from the punch system for this day. This is different from an absence.', explains);
        if (emailsOnly.includes(e.officeId)) {
          // No attendance system: a late arrival is known only from an email, and it still counts as a late mark.
          for (const ex of explains[`${code}|${date}`] ?? []) {
            if (ex.covers !== 'late' || !ex.applied) continue;
            this.issue(code, date, 'Late arrival', 'low', `Late arrival reported by email "${ex.subject}".`, {});
            const x = this.issues[this.issues.length - 1];
            x.emailId = ex.emailId;
            x.timeline.push({ at: ex.at, text: `Read from email "${ex.subject}"` });
          }
          continue;
        }
        if (rec.code === 'HL' && !this.hol[e.calendarId]?.[date] && rec.device?.status === 'HL') {
          this.issue(code, date, 'Holiday not on calendar', 'low', `The punch system marked a holiday that is not on the ${this.calNames[e.calendarId] ?? "person's"} calendar. If it is a real holiday, add it on the Rules page.`, explains);
        }
        if (rec.code !== 'P' && rec.code !== 'HD') continue;
        if (rec.shift === 'SHEET') {
          // A hand-kept sheet has no punch times; its own late marks (L1, L2, ...) are taken as they are.
          const mark = /^LT \((.+)\)$/.exec(rec.device?.remark ?? '')?.[1];
          if (mark) this.issue(code, date, 'Late arrival', 'low', `Marked late (${mark}) on the ${this.offices[e.officeId]?.name ?? ''} attendance sheet.`, explains);
          continue;
        }
        const inT = rec.login ?? null;
        const outT = rec.logout ?? null;
        const devNote = rec.device?.remark ? ` Punch system note: ${rec.device.remark}.` : '';
        if (inT == null && outT != null) this.issue(code, date, 'Missing punch-in', 'medium', `Punch-out at ${D.hm(outT)} but no punch-in.`, explains);
        if (inT != null && outT == null) this.issue(code, date, 'Missing punch-out', 'medium', `Punch-in at ${D.hm(inT)} but no punch-out, so hours show as zero.`, explains);
        if (inT == null && outT == null) this.issue(code, date, 'Missing punch-in', 'medium', 'Marked present by the punch system, but there are no punch times.', explains);
        if (rec.scheduledStart == null || rec.scheduledEnd == null || inT == null) continue;
        const s = rec.scheduledStart;
        const end = rec.scheduledEnd;
        const late = D.diff(s, inT);
        const grace = this.offices[e.officeId]?.graceMinutes ?? r.graceMinutes;
        if (late > grace && late < 240) {
          this.issue(code, date, 'Late arrival', late > 60 ? 'medium' : 'low', `In at ${D.hm(inT)}, shift ${rec.shift} starts ${D.hm(s)}. ${late} min late (grace is ${grace} min).${devNote}`, explains);
        }
        const earlyBy = outT == null ? 0 : D.diff(outT, end);
        const early = outT != null && earlyBy > r.earlyToleranceMinutes && earlyBy < 600;
        if (early) this.issue(code, date, 'Early departure', 'low', `Out at ${D.hm(outT)}, shift ends ${D.hm(end)}.${devNote}`, explains);
        const worked = rec.minutesWorked;
        const sched = D.span(s, end);
        if (worked === 0) this.issue(code, date, 'Zero hours', 'medium', `Punch-in and punch-out are both ${D.hm(inT)}, so hours show as zero.`, explains);
        else if (worked != null && !early && worked < sched - r.shortHoursToleranceMinutes) {
          this.issue(code, date, 'Short hours', rec.code === 'HD' ? 'low' : 'medium', `Worked ${D.dur(worked)} of ${D.dur(sched)} scheduled.${rec.code === 'HD' ? ' Counted as a half day.' : ''}`, explains);
        }
        if (late >= 240 || late <= -180) this.issue(code, date, 'Unusual login time', 'medium', `Login at ${D.hm(inT)} ${tz} is far from the usual start of ${D.hm(s)}.`, explains);
      }
      this.absenceRun(code, run, explains);
    }

    // Late allowance: each office allows a number of late marks a month. Every late arrival counts, in date order.
    this.applyLateAllowance();

    // 4. The same gap for many people in one office on one day points to a device problem.
    const groups: Record<string, IssueWithKey[]> = {};
    for (const x of this.issues) {
      if (!['Missing punch-in', 'Missing punch-out', 'Missing record'].includes(x.type)) continue;
      (groups[`${this.emps[x.employeeId].officeId}|${x.date}|${x.type}`] ??= []).push(x);
    }
    for (const [k, list] of Object.entries(groups)) {
      if (list.length < r.systemIssueMinPeople) continue;
      const office = this.offices[k.split('|')[0]]?.name ?? '';
      for (const x of list) {
        x.state = 'system';
        x.severity = 'low';
        x.detail += ` ${list.length} people at ${office} have the same gap on this day, which points to a device or sync problem.`;
        x.timeline.push({ at: this.foundAt, text: `Grouped with ${list.length - 1} similar cases. Not counted against the employee.` });
      }
    }

    // 5. Reminders already sent, and punches that arrived in a later file.
    const k = await db();
    const sent = new Map<string, { at: string; to_addr: string; sent: number }>();
    for (const n of await k('notifications').where({ month }).whereNotNull('issue_key')) sent.set(n.issue_key, n);
    for (const x of this.issues) {
      const n = sent.get(x.key);
      if (!n) continue;
      if (x.state === 'open') x.state = 'reminded';
      x.timeline.push({ at: n.at, text: Number(n.sent) ? `Reminder emailed to ${n.to_addr}` : `Reminder prepared for ${n.to_addr}, not sent` });
    }
    for (const i of imports) await this.lateData(i, records);

    // Settings, People-page and file changes that touch this month.
    for (const a of await k('audit').orderBy('id')) {
      const inMonth = a.date ? String(a.date).startsWith(month) : String(a.at).startsWith(month);
      if (!inMonth) continue;
      this.changes.push({
        id: `A${a.id}`, at: a.at, employeeId: a.emp_code, subject: a.emp_code ? null : a.subject, date: a.date,
        from: a.from_val, to: a.to_val, reason: a.reason + (a.user_name && a.user_name !== 'System' ? ` (by ${a.user_name})` : ''), source: a.source as ChangeSource,
      });
    }

    this.changes.sort((a, b) => b.at.localeCompare(a.at));
    emails.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    const notifications = await this.notifications();
    return {
      month, dataThrough: dataThrough ?? dates[0], hasData: raw.length > 0, partial: raw.length > 0 && partial, records,
      issues: this.issues.map(({ key: _key, ...x }) => x),
      emails, changes: this.changes, notifications, sources: this.sources(imports), close: await this.close(imp ? this.foundAt : null),
    };
  }

  private issue(code: string, date: string, type: IssueType, severity: Severity, detail: string, explains: Record<string, Explain[]>) {
    const key = issueKey(code, date, type);
    const x: IssueWithKey = { id: hash(this.month + key), key, employeeId: code, date, type, severity, state: 'open', detail, timeline: [{ at: this.foundAt, text: 'Found when the attendance file was checked' }] };
    for (const ex of explains[`${code}|${date}`] ?? []) {
      const ok =
        ex.covers === 'absence' ? ['Unexplained absence', 'Long absence', 'Missing record'].includes(type)
        : ex.covers === 'late' ? type === 'Late arrival'
        : ex.covers === 'early' ? type === 'Early departure' || type === 'Short hours'
        : ex.covers === 'wfh' ? ['Unexplained absence', 'Long absence', 'Missing record', 'Missing punch-in', 'Missing punch-out'].includes(type)
        : ['Missing punch-in', 'Missing punch-out', 'Zero hours'].includes(type);
      if (!ok) continue;
      x.emailId = ex.emailId;
      x.state = ex.applied ? 'explained' : 'unclear';
      x.timeline.push({ at: ex.at, text: ex.applied ? `Explained by email "${ex.subject}"` : `Email "${ex.subject}" may be about this, but the match is unclear (${ex.confidence}%). Kept as communicated, unclear.` });
      if (!ex.applied && type === 'Unexplained absence') x.detail = 'No punches and no leave on record. An email arrived but could not be matched with confidence.';
      break;
    }
    this.issues.push(x);
  }

  private applyLateAllowance() {
    const byEmp = new Map<string, IssueWithKey[]>();
    for (const x of this.issues) if (x.type === 'Late arrival') (byEmp.get(x.employeeId) ?? byEmp.set(x.employeeId, []).get(x.employeeId)!).push(x);
    for (const [code, lates] of byEmp) {
      const office = this.offices[this.emps[code]?.officeId];
      const allowed = office?.lateAllowance ?? 0;
      if (!allowed) continue;
      lates.sort((a, b) => a.date.localeCompare(b.date));
      lates.forEach((x, i) => {
        const n = i + 1;
        if (n <= allowed) {
          x.detail += ` Late mark ${n} of ${allowed} allowed this month.`;
          if (x.state === 'open') { x.state = 'allowed'; x.severity = 'low'; }
        } else {
          x.detail += ` Late mark ${n}: beyond the ${allowed} allowed this month.${office?.lateBeyondNote ? ` ${office.lateBeyondNote}` : ''}${x.state === 'explained' ? ' It was explained by email, but still counts as a late mark.' : ''}`;
          x.state = 'open';
          x.severity = 'medium';
        }
      });
    }
  }

  private weeklyOff(officeId: string): number[] {
    return this.offices[officeId]?.weeklyOff ?? this.r.weeklyOff;
  }

  /** Short runs of absence are flagged day by day; long runs become one item, since they are usually leave or a leaver. */
  private absenceRun(code: string, run: string[], explains: Record<string, Explain[]>) {
    if (!run.length) return;
    if (run.length >= this.r.longAbsenceDays) {
      this.issue(code, run[0], 'Long absence', 'high', `Absent ${run.length} working days in a row (${D.short(run[0])} to ${D.short(run[run.length - 1])}). Usually leave or someone who has left: send an email about it, or set a leaving date on the People page.`, explains);
      return;
    }
    for (const d of run) this.issue(code, d, 'Unexplained absence', 'high', 'No punches, no leave on record and no email about this day.', explains);
  }

  /** Punches missing in an earlier file for this month that a later file filled in. */
  private async lateData(imp: R.ImportRow, records: Record<string, Record<string, DayRecord>>) {
    const prev = await R.previousImport(this.month, imp.id, imp.scope || 'punch');
    if (!prev) return;
    for (const old of await R.rawDays(prev.id)) {
      const rec = records[old.emp_code]?.[old.date];
      if (!rec) continue;
      for (const [col, field, label, type] of [['in_min', 'login', 'Punch-in', 'Missing punch-in'], ['out_min', 'logout', 'Punch-out', 'Missing punch-out']] as const) {
        const value = rec[field];
        if (old[col] != null || value == null) continue;
        this.change(imp.imported_at, old.emp_code, old.date, `${label} missing`, D.hm(value), `Arrived in a later file (${imp.file_name}). Taken as sent.`, 'Late data');
        this.issues.push({
          id: hash(this.month + old.emp_code + old.date + type + 'late'), key: '', employeeId: old.emp_code, date: old.date, type, severity: 'medium', state: 'fixed',
          detail: `${label} was missing in the first file and arrived later.`,
          timeline: [{ at: prev.imported_at, text: 'Found when the attendance file was checked' }, { at: imp.imported_at, text: `${label} of ${D.hm(value)} arrived in a later file. Fixed.` }],
        });
      }
    }
  }

  private async monthEmails() {
    const dates = D.monthDates(this.month);
    const from = D.addDays(dates[0], -62);
    const to = `${D.addDays(dates[dates.length - 1], 31)}T23:59`;
    const rows = await (await db())('emails').where('received_at', '>=', from).andWhere('received_at', '<=', to).orderBy('received_at');
    return rows.filter((m) => {
      const ds = JSON.parse(m.dates || '[]') as string[];
      return ds.some((d) => d.startsWith(this.month)) || (!ds.length && String(m.received_at).startsWith(this.month));
    });
  }

  private async notifications(): Promise<Notification[]> {
    const keyToId = new Map(this.issues.filter((x) => x.key).map((x) => [x.key, x.id]));
    const rows = await (await db())('notifications').where({ month: this.month }).orderBy([{ column: 'at', order: 'desc' }, { column: 'id', order: 'desc' }]);
    return rows.map((n) => ({
      id: `N${n.id}`, at: n.at, to: n.to_addr, audience: n.audience, subject: n.subject,
      issueIds: n.issue_key && keyToId.has(n.issue_key) ? [keyToId.get(n.issue_key)!] : [], sent: Boolean(Number(n.sent)), error: n.error || null,
    }));
  }

  private sources(imports: R.ImportRow[]): SourceHealth[] {
    return Object.values(this.offices).map((o) => {
      if (o.mode === 'emails') {
        return { name: `${o.name}: ${o.source}`, officeId: o.id, state: 'ok', ok: true, lastSync: '', note: 'No attendance system. Leave and late arrivals come from emails to HR; holidays and weekly offs from the calendar.' };
      }
      const imp = imports.find((i) => (o.mode === 'sheet' ? i.scope === `sheet-${o.id}` : (i.scope || 'punch') === 'punch'));
      const connected = o.mode === 'sheet' || o.departments.length > 0;
      const how = o.mode === 'sheet' ? 'the monthly attendance sheet' : 'the punch system export';
      return {
        name: `${o.name}: ${o.source}`, officeId: o.id, state: !connected ? 'off' : imp ? 'ok' : 'warn', ok: connected && !!imp, lastSync: imp?.imported_at ?? '',
        note: !connected ? 'No attendance source connected for this office yet.' : imp ? `From ${imp.file_name}, imported ${D.when(imp.imported_at)}.` : `No file for this month yet. Upload ${how} on Attendance files.`,
      };
    });
  }

  private async close(lastImportAt: string | null) {
    const reports = await (await db())('reports').where({ month: this.month }).orderBy('version', 'desc');
    let closesAt = `${D.nextMonth(this.month)}-${String(this.r.closeDay).padStart(2, '0')}T06:00`;
    if (lastImportAt && lastImportAt > closesAt) closesAt = lastImportAt;
    return {
      month: this.month, closed: reports.length > 0,
      closesAt: reports.length ? reports[reports.length - 1].created_at : closesAt,
      reportsSentTo: reports.length ? JSON.parse(reports[0].sent_to) : [],
      reports: reports.map((rp) => ({ id: Number(rp.id), version: Number(rp.version), createdAt: rp.created_at, note: rp.note, sentTo: JSON.parse(rp.sent_to) })),
    };
  }

  private change(at: string, emp: string | null, date: string | null, from: string, to: string, reason: string, source: ChangeSource, emailId: string | null = null, subject: string | null = null) {
    this.changes.push({ id: `${this.month}-C${++this.changeN}`, at, employeeId: emp, subject, date, from, to, reason, source, emailId });
  }
}

/** Short stable id, the same every time the month is rebuilt. */
function hash(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619);
    h2 = Math.imul(h2 ^ s.charCodeAt(i), 2246822519);
  }
  return ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)).slice(0, 12);
}
