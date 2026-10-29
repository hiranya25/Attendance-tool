import type { Employee, MonthData, Office } from '../types';
import { CODE_LABEL, STATE_LABEL } from '../components/ui';
import { hhmm, hm, monthDates } from './format';
import { totals } from './stats';

const cellCode = (code: string, leave?: string) => (code === 'LV' && leave ? leave.replace(' leave', '').toUpperCase().slice(0, 4) : code === 'F' ? '' : code);

/** Master attendance file: one row per person, one column per day, totals at the end. */
export function masterRows(data: MonthData, emp: (id: string) => Employee, office: (id: string) => Office) {
  const dates = monthDates(data.month);
  const head = ['Code', 'Name', 'Office', 'Department', ...dates.map((d) => String(Number(d.slice(8)))), 'Present', 'Absent', 'Leave', 'Holiday', 'Weekly off', 'Hours worked'];
  const rows = Object.keys(data.records).map((id) => {
    const e = emp(id);
    const days = dates.map((d) => data.records[id][d]);
    const t = totals(days);
    return [e.id, e.name, office(e.officeId).name, e.department, ...days.map((d) => cellCode(d.code, d.leaveType)), t.present, t.absent, t.leave, t.holiday, t.weeklyOff, hhmm(t.minutes)];
  });
  return [head, ...rows];
}

/** Daily detail: one row per person per day with times. */
export function dailyRows(data: MonthData, emp: (id: string) => Employee, office: (id: string) => Office) {
  const head = ['Date', 'Code', 'Name', 'Office', 'Status', 'Scheduled', 'Login', 'Logout', 'Hours', 'Changed by tool', 'Original status'];
  const rows: (string | number)[][] = [];
  for (const [id, days] of Object.entries(data.records)) {
    for (const d of Object.values(days)) {
      if (d.code === 'F') continue;
      rows.push([d.date, id, emp(id).name, office(emp(id).officeId).name, d.leaveType ?? CODE_LABEL[d.code],
        d.scheduledStart != null ? `${hm(d.scheduledStart)}-${hm(d.scheduledEnd)}` : '', d.login != null ? hm(d.login) : '', d.logout != null ? hm(d.logout) : '',
        d.minutesWorked != null ? hhmm(d.minutesWorked) : '', d.original ? 'Yes' : '', d.original ? CODE_LABEL[d.original.code] : '']);
    }
  }
  return [head, ...rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])))];
}

export function issueRows(data: MonthData, emp: (id: string) => Employee, office: (id: string) => Office) {
  const head = ['Date', 'Code', 'Name', 'Office', 'Issue', 'Priority', 'Status', 'Detail', 'Linked email'];
  const rows = data.issues.map((x) => [x.date, x.employeeId, emp(x.employeeId).name, office(emp(x.employeeId).officeId).name, x.type, x.severity, STATE_LABEL[x.state], x.detail, x.emailId ?? '']);
  return [head, ...rows];
}

export function changeRows(data: MonthData, emp: (id: string) => Employee) {
  const head = ['When', 'Who it affects', 'Day', 'From', 'To', 'Why', 'Source'];
  return [head, ...data.changes.map((c) => [c.at.replace('T', ' '), c.employeeId ? emp(c.employeeId).name : c.subject ?? '', c.date ?? '', c.from, c.to, c.reason, c.source])];
}
