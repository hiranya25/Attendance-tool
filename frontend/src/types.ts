// Shared data model. The backend API should return exactly these shapes.
// Dates are ISO strings ("2026-10-28"); months are "2026-10"; times are minutes after midnight in the office's own time zone.

export type OfficeId = string;

export interface Office {
  id: OfficeId;
  name: string;
  timeZone: string; // IANA, e.g. "Asia/Kolkata"
  tzLabel: string; // short label shown in the UI, e.g. "IST"
  shiftStart: number;
  shiftEnd: number;
  calendar: 'IN' | 'US';
  source: string; // where this office's attendance comes from
}

export interface Employee {
  id: string;
  name: string;
  officeId: OfficeId;
  department: string;
  email: string;
  joinDate: string;
  exitDate?: string;
}

export interface Holiday {
  date: string;
  name: string;
  calendar: 'IN' | 'US';
}

/**
 * Day status codes.
 * P present, HD half day, A absent, LV leave, HL holiday, WO weekly off,
 * NR no record received, NE not employed that day (before joining or after leaving), F future day.
 */
export type DayCode = 'P' | 'HD' | 'A' | 'LV' | 'HL' | 'WO' | 'NR' | 'NE' | 'F';

export type LeaveType = 'Sick leave' | 'Planned leave' | 'Unpaid leave' | 'Other leave';

export interface DayRecord {
  employeeId: string;
  date: string;
  code: DayCode;
  leaveType?: LeaveType;
  note?: string;
  scheduledStart?: number;
  scheduledEnd?: number;
  login?: number | null;
  logout?: number | null;
  minutesWorked?: number;
  punches?: number;
  /** What the source system sent, kept when the tool changed this day. */
  original?: { code: DayCode; login?: number | null; logout?: number | null };
}

export type Severity = 'high' | 'medium' | 'low';

/** Every state is set by the tool itself. Nobody has to approve anything. */
export type IssueState =
  | 'open' // flagged, nothing has happened yet
  | 'reminded' // reminder emailed to the employee
  | 'explained' // an email on file covers it and was applied
  | 'unclear' // an email arrived but could not be matched with confidence
  | 'fixed' // corrected data arrived later
  | 'system'; // many people hit the same problem at once, likely a device or sync fault

export type IssueType =
  | 'Unexplained absence'
  | 'Missing record'
  | 'Missing punch-in'
  | 'Missing punch-out'
  | 'Late arrival'
  | 'Early departure'
  | 'Short hours'
  | 'Zero hours'
  | 'Duplicate punches'
  | 'Unusual login time';

export interface TimelineEntry {
  at: string; // ISO date-time
  text: string;
}

export interface Issue {
  id: string;
  employeeId: string;
  date: string;
  type: IssueType;
  severity: Severity;
  state: IssueState;
  detail: string;
  emailId?: string;
  timeline: TimelineEntry[];
}

export type EmailOutcome = 'applied' | 'unclear' | 'not-attendance';

export interface HrEmail {
  id: string;
  from: string;
  receivedAt: string;
  subject: string;
  body: string;
  detected: string;
  employeeId?: string;
  dates: string[];
  confidence: number;
  outcome: EmailOutcome;
  action: string; // what the tool did, in plain words
  warning?: string;
}

export type ChangeSource = 'HR email' | 'Late data' | 'Employee list' | 'Holiday calendar' | 'Settings';

export interface ChangeEntry {
  id: string;
  at: string;
  employeeId?: string;
  subject?: string; // used when a change covers many people or no person
  date?: string;
  from: string;
  to: string;
  reason: string;
  source: ChangeSource;
  emailId?: string;
}

export interface Notification {
  id: string;
  at: string;
  to: string;
  audience: 'Employee' | 'HR' | 'Management';
  subject: string;
  issueIds: string[];
}

export interface SourceHealth {
  name: string;
  officeId: OfficeId;
  lastSync: string;
  ok: boolean;
  note: string;
}

export interface MonthClose {
  month: string;
  closesAt: string;
  closed: boolean;
  reportsSentTo: string[];
}

export interface MonthData {
  month: string;
  dataThrough: string; // last date with data
  records: Record<string, Record<string, DayRecord>>; // employeeId -> date -> record
  issues: Issue[];
  emails: HrEmail[];
  changes: ChangeEntry[];
  notifications: Notification[];
  sources: SourceHealth[];
  close: MonthClose;
}

export interface TrendPoint {
  month: string;
  issues: number;
  unexplained: number;
  lates: number;
  presentRate: number;
}

export interface Settings {
  graceMinutes: number;
  earlyToleranceMinutes: number;
  shortHoursToleranceMinutes: number;
  halfDayBelowHours: number;
  duplicatePunchLimit: number;
  systemIssueMinPeople: number;
  autoApplyConfidence: number;
  remindersOn: boolean;
  reminderAfterDays: number;
  hrDigestTime: string;
  closeDay: number; // day of next month the tool closes the month
  reportRecipients: string[];
  weeklyOff: number[]; // 0 Sunday ... 6 Saturday
  shifts: Record<OfficeId, { start: number; end: number }>;
}

export interface Reference {
  offices: Office[];
  employees: Employee[];
  holidays: Holiday[];
  settings: Settings;
  today: string;
  months: string[];
}
