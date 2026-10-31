// Fictional sample data for the demo. Names and emails are invented.
import type { Calendar, Employee, Holiday, Office, Settings, Shift } from '../types';

export const TODAY = '2026-10-29';
export const MONTHS = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];

export const OFFICES: Office[] = [
  { id: 'indore', name: 'Indore', timeZone: 'Asia/Kolkata', tzLabel: 'IST', source: 'Indore biometric', departments: ['INDORE'] },
  { id: 'mumbai', name: 'Mumbai', timeZone: 'Asia/Kolkata', tzLabel: 'IST', source: 'Mumbai biometric', departments: ['MUMBAI'] },
  { id: 'newyork', name: 'New York', timeZone: 'America/New_York', tzLabel: 'ET', source: 'New York door system', departments: ['NEW YORK'] },
  { id: 'remote', name: 'Remote', timeZone: 'Asia/Kolkata', tzLabel: 'IST', source: 'Remote login tracker', departments: ['REMOTE'] },
];

export const SHIFTS: Shift[] = [
  { code: 'G', name: 'General shift', start: 570, end: 1110, confirmed: true },
  { code: 'M', name: 'Mumbai shift', start: 600, end: 1140, confirmed: true },
  { code: 'NY', name: 'New York shift', start: 540, end: 1020, confirmed: true },
];

export const CALENDARS: Calendar[] = [
  { id: 'IN', name: 'India holidays', description: 'Indore, Mumbai and remote staff.' },
  { id: 'US', name: 'US holidays', description: 'New York office.' },
];

const SHIFT_OF: Record<string, string> = { indore: 'G', mumbai: 'M', newyork: 'NY', remote: 'M' };
const CAL_OF: Record<string, string> = { indore: 'IN', mumbai: 'IN', newyork: 'US', remote: 'IN' };
const person = (e: { id: string; name: string; officeId: string; department: string; email: string; joinDate: string; exitDate?: string }): Employee => ({
  ...e, exitDate: e.exitDate ?? null, shiftCode: SHIFT_OF[e.officeId], calendarId: CAL_OF[e.officeId], aliases: '',
});

export const EMPLOYEES: Employee[] = [
  person({ id: 'E101', name: 'Aarav Mehta', officeId: 'indore', department: 'Engineering', email: 'aarav.mehta@example.com', joinDate: '2023-04-03' }),
  person({ id: 'E102', name: 'Neha Joshi', officeId: 'indore', department: 'Engineering', email: 'neha.joshi@example.com', joinDate: '2022-08-16' }),
  person({ id: 'E103', name: 'Rohan Patil', officeId: 'indore', department: 'Operations', email: 'rohan.patil@example.com', joinDate: '2024-01-08' }),
  person({ id: 'E104', name: 'Divya Rao', officeId: 'indore', department: 'Finance', email: 'divya.rao@example.com', joinDate: '2021-11-01' }),
  person({ id: 'E105', name: 'Kunal Shah', officeId: 'indore', department: 'Support', email: 'kunal.shah@example.com', joinDate: '2025-02-17' }),
  person({ id: 'E106', name: 'Pooja Verma', officeId: 'indore', department: 'Design', email: 'pooja.verma@example.com', joinDate: '2026-10-12' }),
  person({ id: 'E201', name: 'Isha Kapoor', officeId: 'mumbai', department: 'Operations', email: 'isha.kapoor@example.com', joinDate: '2020-06-01' }),
  person({ id: 'E202', name: 'Vikram Nair', officeId: 'mumbai', department: 'Engineering', email: 'vikram.nair@example.com', joinDate: '2023-09-11' }),
  person({ id: 'E203', name: 'Sana Qureshi', officeId: 'mumbai', department: 'Finance', email: 'sana.qureshi@example.com', joinDate: '2022-03-21' }),
  person({ id: 'E204', name: 'Manav Desai', officeId: 'mumbai', department: 'Support', email: 'manav.desai@example.com', joinDate: '2024-07-15' }),
  person({ id: 'E205', name: 'Ritesh Jain', officeId: 'mumbai', department: 'Sales', email: 'ritesh.jain@example.com', joinDate: '2023-01-09', exitDate: '2026-10-09' }),
  person({ id: 'E301', name: 'Maya Collins', officeId: 'newyork', department: 'Finance', email: 'maya.collins@example.com', joinDate: '2021-05-10' }),
  person({ id: 'E302', name: 'Daniel Ortiz', officeId: 'newyork', department: 'Operations', email: 'daniel.ortiz@example.com', joinDate: '2022-10-03' }),
  person({ id: 'E303', name: 'Grace Liu', officeId: 'newyork', department: 'Support', email: 'grace.liu@example.com', joinDate: '2024-03-04' }),
  person({ id: 'E304', name: 'Ben Harper', officeId: 'newyork', department: 'Sales', email: 'ben.harper@example.com', joinDate: '2025-06-02' }),
  person({ id: 'E401', name: 'Tanvi Bose', officeId: 'remote', department: 'Engineering', email: 'tanvi.bose@example.com', joinDate: '2023-02-13' }),
  person({ id: 'E402', name: 'Arjun Kulkarni', officeId: 'remote', department: 'Engineering', email: 'arjun.kulkarni@example.com', joinDate: '2024-05-20' }),
  person({ id: 'E403', name: 'Farah Sheikh', officeId: 'remote', department: 'Support', email: 'farah.sheikh@example.com', joinDate: '2022-12-05' }),
  person({ id: 'E404', name: 'Kabir Malhotra', officeId: 'remote', department: 'Design', email: 'kabir.malhotra@example.com', joinDate: '2025-09-01' }),
];

export const HOLIDAYS: Holiday[] = [
  { date: '2026-01-01', name: "New Year's Day", calendar: 'IN' },
  { date: '2026-01-26', name: 'Republic Day', calendar: 'IN' },
  { date: '2026-03-04', name: 'Holi', calendar: 'IN' },
  { date: '2026-08-15', name: 'Independence Day', calendar: 'IN' },
  { date: '2026-08-28', name: 'Raksha Bandhan', calendar: 'IN' },
  { date: '2026-10-02', name: 'Gandhi Jayanti', calendar: 'IN' },
  { date: '2026-10-20', name: 'Dussehra', calendar: 'IN' },
  { date: '2026-11-09', name: 'Diwali (observed)', calendar: 'IN' },
  { date: '2026-12-25', name: 'Christmas', calendar: 'IN' },
  { date: '2026-01-01', name: "New Year's Day", calendar: 'US' },
  { date: '2026-05-25', name: 'Memorial Day', calendar: 'US' },
  { date: '2026-06-19', name: 'Juneteenth', calendar: 'US' },
  { date: '2026-07-03', name: 'Independence Day (observed)', calendar: 'US' },
  { date: '2026-09-07', name: 'Labor Day', calendar: 'US' },
  { date: '2026-10-12', name: "Indigenous Peoples' Day", calendar: 'US' },
  { date: '2026-11-26', name: 'Thanksgiving', calendar: 'US' },
  { date: '2026-12-25', name: 'Christmas', calendar: 'US' },
];

export const DEFAULT_SETTINGS: Settings = {
  graceMinutes: 15,
  earlyToleranceMinutes: 30,
  shortHoursToleranceMinutes: 90,
  halfDayBelowHours: 4.5,
  systemIssueMinPeople: 3,
  longAbsenceDays: 5,
  autoApplyConfidence: 80,
  remindersOn: false,
  reminderAfterDays: 1,
  reminderWindowDays: 7,
  hrDigestOn: false,
  hrDigestTime: '18:00',
  hrEmail: 'hr@amipi.com',
  closeDay: 1,
  reportRecipients: ['hr@amipi.com', 'founder@example.com'],
  weeklyOff: [0, 6],
  punchFileName: 'monthdatewiseperformance',
};

/** Planned October problems, so every kind of issue shows up in the demo. Day of month -> kind. */
export type Plant = 'late' | 'missout' | 'missin' | 'short' | 'early' | 'dup' | 'abs' | 'norec' | 'zero' | 'odd' | 'half';
export const OCT_PLANTS: Record<string, Record<number, Plant>> = {
  E101: { 6: 'late', 13: 'late', 15: 'late', 21: 'late', 27: 'late' },
  E102: { 8: 'abs', 14: 'abs', 15: 'abs' },
  E103: { 7: 'missout', 16: 'abs', 23: 'abs' },
  E104: { 9: 'short', 22: 'early' },
  E105: { 12: 'dup', 26: 'abs', 27: 'abs', 28: 'abs' },
  E201: { 14: 'missout' },
  E202: { 14: 'missout', 21: 'late' },
  E203: { 5: 'abs', 14: 'missout' },
  E204: { 9: 'abs', 14: 'missout', 16: 'late' },
  E301: { 20: 'late' },
  E302: { 6: 'missin' },
  E303: { 15: 'abs', 16: 'abs' },
  E304: { 19: 'half' },
  E401: { 8: 'norec' },
  E402: { 13: 'zero', 22: 'odd' },
  E403: { 21: 'abs', 23: 'missout' },
};

/** Punches that arrived a day or more late from the device, fixing a missing punch. */
export const LATE_FIXES: { employeeId: string; date: string; field: 'logout' | 'login'; value: number; at: string }[] = [
  { employeeId: 'E103', date: '2026-10-07', field: 'logout', value: 1132, at: '2026-10-08T11:40' },
  { employeeId: 'E302', date: '2026-10-06', field: 'login', value: 548, at: '2026-10-07T09:05' },
];

export interface SeedEmail {
  id: string;
  from: string;
  receivedAt: string;
  subject: string;
  body: string;
  detected: string;
  employeeId?: string;
  dates: string[];
  confidence: number;
  leaveType?: 'Sick leave' | 'Planned leave' | 'Unpaid leave';
  covers?: 'absence' | 'late' | 'early';
  warning?: string;
}

export const OCT_EMAILS: SeedEmail[] = [
  { id: 'M1', from: 'sana.qureshi@example.com', receivedAt: '2026-09-28T17:40', subject: 'Leave request for 5 October', body: 'I would like to take a day off on Monday 5 October for a family function. My work is handed over to Vikram.', detected: 'Planned leave', employeeId: 'E203', dates: ['2026-10-05'], confidence: 93, leaveType: 'Planned leave', covers: 'absence' },
  { id: 'M2', from: 'neha.joshi@example.com', receivedAt: '2026-10-08T08:12', subject: 'Not well today', body: 'Hi HR, I have a fever and will not be able to come in today. I will share a doctor note once I recover.', detected: 'Sick leave', employeeId: 'E102', dates: ['2026-10-08'], confidence: 96, leaveType: 'Sick leave', covers: 'absence' },
  { id: 'M3', from: 'neha.joshi@example.com', receivedAt: '2026-10-01T10:20', subject: 'Vacation 14-15 Oct', body: 'Hi, sharing that I will be on vacation on 14 and 15 October. Aarav will cover for me.', detected: 'Planned leave', employeeId: 'E102', dates: ['2026-10-14', '2026-10-15'], confidence: 95, leaveType: 'Planned leave', covers: 'absence' },
  { id: 'M4', from: 'gracel.personal@example.net', receivedAt: '2026-10-15T07:30', subject: 'Sick today', body: 'Not feeling well, will update later.', detected: 'Sick leave', employeeId: 'E303', dates: ['2026-10-15'], confidence: 71, leaveType: 'Sick leave', covers: 'absence', warning: 'Sent from a personal address. Name matched from the signature only, and no end date was given.' },
  { id: 'M5', from: 'manav.desai@example.com', receivedAt: '2026-10-15T21:10', subject: 'Late tomorrow', body: 'My bus has broken down on the highway. I will reach the office a bit late tomorrow morning.', detected: 'Late arrival', employeeId: 'E204', dates: ['2026-10-16'], confidence: 94, covers: 'late' },
  { id: 'M6', from: 'farah.sheikh@example.com', receivedAt: '2026-10-20T18:20', subject: 'Out tomorrow', body: 'I will not be available tomorrow. Please mark me absent, I will take it as unpaid.', detected: 'Unpaid leave', employeeId: 'E403', dates: ['2026-10-21'], confidence: 88, leaveType: 'Unpaid leave', covers: 'absence' },
  { id: 'M7', from: 'divya.rao@example.com', receivedAt: '2026-10-21T16:55', subject: 'Doctor appointment Thursday', body: 'I need to leave by 4:30 pm on Thursday for a doctor appointment. I will make up the time over the weekend.', detected: 'Early departure', employeeId: 'E104', dates: ['2026-10-22'], confidence: 89, covers: 'early' },
  { id: 'M8', from: 'reena.iyer@example.com', receivedAt: '2026-10-23T11:02', subject: 'Kunal on leave next week', body: 'Please note Kunal Shah will be on leave from 26 to 28 October.', detected: 'Planned leave (sent by manager)', employeeId: 'E105', dates: ['2026-10-26', '2026-10-27', '2026-10-28'], confidence: 90, leaveType: 'Planned leave', covers: 'absence' },
  { id: 'M9', from: 'accounts@example.com', receivedAt: '2026-10-21T10:05', subject: 'Payslip query', body: "Could you share last month's payslip breakup?", detected: 'Not about attendance', dates: [], confidence: 99 },
  { id: 'M10', from: 'r.patil.home@example.net', receivedAt: '2026-10-23T09:48', subject: 'Re: today', body: 'Cant come today, some urgent work at home. Will cover on sat.', detected: 'Absence', employeeId: 'E103', dates: ['2026-10-23'], confidence: 64, covers: 'absence', warning: 'Personal address and no name in the email. Matched by the "r.patil" part of the address only.' },
];
