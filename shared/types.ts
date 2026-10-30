// Shared data model. The server returns exactly these shapes and the screens read them.
// Dates are ISO strings ("2026-09-28"); months are "2026-09"; times are minutes after midnight, local time.

export type OfficeId = string;

export interface Office {
  id: OfficeId;
  name: string;
  timeZone: string;
  tzLabel: string;
  /** Where this office's attendance comes from. */
  source: string;
  /** Department names in the punch export that belong to this office. Empty when not connected yet. */
  departments: string[];
  /** How attendance arrives: the punch export, a daily sheet (OK / L1 / A), or HR emails only. */
  mode?: 'punch' | 'sheet' | 'emails';
  /** Days the office is closed, 0 Sunday ... 6 Saturday. */
  weeklyOff?: number[];
  /** Minutes after shift start before someone counts as late. */
  graceMinutes?: number;
  /** Late marks allowed per month before they count against the person. */
  lateAllowance?: number;
  /** What the policy says happens after the allowance, shown on each late beyond it. */
  lateBeyondNote?: string;
}

/** A shift code from the punch system, with its scheduled times. */
export interface Shift {
  code: string;
  name: string;
  start: number;
  end: number;
  /** False while the times are only estimated from past data. */
  confirmed: boolean;
}

export interface Calendar {
  id: string;
  name: string;
  description: string;
}

export interface Employee {
  id: string; // employee code from the punch system, e.g. "0001"
  name: string;
  officeId: OfficeId;
  department: string;
  email: string;
  joinDate: string | null;
  exitDate: string | null;
  shiftCode: string;
  calendarId: string;
  /** Nicknames used in emails, e.g. "Jolly". */
  aliases: string;
  manager?: string;
  role?: string;
  /** Where they work, from the team list (for example "MUMBAI/DUBAI"). */
  location?: string;
  /** From the team list: "Full Time", "Day Time", "Part Time" or "NA". */
  workHours?: string;
  /** False for people not tracked by the attendance tool ("NA" on the team list). */
  tracked?: boolean;
}

export interface Holiday {
  date: string;
  name: string;
  calendar: string; // Calendar.id
}

/**
 * Day status codes.
 * P present, HD half day, A absent, LV leave, HL holiday, WO weekly off,
 * NR no record received, NE not employed that day (before joining or after leaving), F not yet in the data,
 * NT no attendance system for this office (tracked through HR emails only).
 */
export type DayCode = 'P' | 'HD' | 'A' | 'LV' | 'HL' | 'WO' | 'NR' | 'NE' | 'F' | 'NT';

export type LeaveType = 'Sick leave' | 'Planned leave' | 'Unpaid leave' | 'Other leave';

export interface DayRecord {
  employeeId: string;
  date: string;
  code: DayCode;
  leaveType?: LeaveType;
  note?: string;
  shift?: string | null;
  scheduledStart?: number;
  scheduledEnd?: number;
  login?: number | null;
  logout?: number | null;
  minutesWorked?: number;
  punches?: number;
  /** What the punch system itself said about this day. */
  device?: { status: string; remark: string; workMinutes: number; lessMinutes: number };
  /** What the source sent, kept when the tool changed this day. */
  original?: { code: DayCode; login?: number | null; logout?: number | null };
}

export type Severity = 'high' | 'medium' | 'low';

/** Every state is set by the tool itself. Nobody has to approve anything. */
export type IssueState =
  | 'open' // flagged, nothing has happened yet
  | 'reminded' // reminder emailed to the employee or HR
  | 'explained' // an email on file covers it and was applied
  | 'unclear' // an email arrived but could not be matched with confidence
  | 'fixed' // corrected data arrived later
  | 'system' // many people hit the same problem at once, likely a device or sync fault
  | 'allowed'; // a late mark within the office's monthly allowance

export type IssueType =
  | 'Unexplained absence'
  | 'Long absence'
  | 'Missing record'
  | 'Missing punch-in'
  | 'Missing punch-out'
  | 'Late arrival'
  | 'Early departure'
  | 'Short hours'
  | 'Zero hours'
  | 'Duplicate punches'
  | 'Unusual login time'
  | 'Holiday not on calendar';

export interface TimelineEntry {
  at: string;
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
  employeeId?: string | null;
  dates: string[];
  confidence: number;
  outcome: EmailOutcome;
  action: string;
  warning?: string | null;
}

export type ChangeSource =
  | 'HR email'
  | 'Late data'
  | 'Employee list'
  | 'Holiday calendar'
  | 'Settings'
  | 'People page'
  | 'Attendance file'
  | 'Attendance file (email)'
  | 'Team list';

export interface ChangeEntry {
  id: string;
  at: string;
  employeeId?: string | null;
  subject?: string | null; // used when a change covers many people or no person
  /** A day ("2026-09-07"), or a whole month ("2026-09") for file imports. */
  date?: string | null;
  from: string;
  to: string;
  reason: string;
  source: ChangeSource;
  emailId?: string | null;
}

export interface Notification {
  id: string;
  at: string;
  to: string;
  audience: 'Employee' | 'HR' | 'Management';
  subject: string;
  issueIds: string[];
  /** False when the message was recorded but not sent (sending off, no address, or an error). */
  sent?: boolean;
  error?: string | null;
}

export interface SourceHealth {
  name: string;
  officeId: OfficeId;
  lastSync: string;
  ok: boolean;
  /** "off" means no source is connected for this office yet. */
  state?: 'ok' | 'warn' | 'off';
  note: string;
}

export interface ReportFile {
  id: number;
  version: number;
  createdAt: string;
  note: string;
  sentTo: string[];
}

export interface MonthClose {
  month: string;
  closesAt: string;
  closed: boolean;
  reportsSentTo: string[];
  reports?: ReportFile[];
}

export interface MonthData {
  month: string;
  dataThrough: string; // last date with data
  hasData?: boolean;
  /** The file does not cover the whole month yet (a month-to-date export). */
  partial?: boolean;
  records: Record<string, Record<string, DayRecord>>; // employeeId -> date -> record
  issues: Issue[];
  emails: HrEmail[];
  changes: ChangeEntry[];
  notifications: Notification[];
  sources: SourceHealth[];
  close: MonthClose;
}

/** One line per month on the Past months page. */
export interface MonthSummary {
  month: string;
  closed: boolean;
  partial: boolean;
  dataThrough: string;
  people: number;
  presentRate: number;
  issues: number;
  needAttention: number;
  unexplained: number;
  latesBeyond: number;
  leaveDays: number;
  files: { fileName: string; scope: string; importedAt: string }[];
  reports: ReportFile[];
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
  systemIssueMinPeople: number;
  longAbsenceDays: number;
  autoApplyConfidence: number;
  remindersOn: boolean;
  reminderAfterDays: number;
  reminderWindowDays: number;
  hrDigestOn: boolean;
  hrDigestTime: string;
  hrEmail: string;
  closeDay: number; // day of next month the tool closes the month
  reportRecipients: string[];
  weeklyOff: number[]; // 0 Sunday ... 6 Saturday
  punchFileName: string; // attachments whose name contains this are imported
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'viewer';
}

export interface ImportRecord {
  id: number;
  /** "punch" for the punch export, "sheet-mumbai" for a hand-kept office sheet. */
  scope?: string;
  month: string;
  fileName: string;
  source: 'upload' | 'email';
  importedAt: string;
  importedBy: string;
  people: number;
  days: number;
}

export interface Connections {
  microsoft: boolean;
  /** The AI model that reads HR emails is set up. */
  ai: boolean;
  aiName: string;
  sendEmail: boolean;
  mailbox: string;
  lastRun: string | null;
  lastRunLog: string[];
}

export interface Reference {
  offices: Office[];
  employees: Employee[];
  holidays: Holiday[];
  calendars: Calendar[];
  shifts: Shift[];
  settings: Settings;
  today: string;
  months: string[];
  /** Newest month that has attendance data; the screens open on it. */
  latestDataMonth?: string | null;
  user?: User | null;
}
