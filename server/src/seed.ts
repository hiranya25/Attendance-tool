// Starting data: offices, holiday calendars, shift timings and rules. Everything here can be changed in the app.
import type { Calendar, Office, Settings } from '../../shared/types.ts';

const NY_BEYOND = 'Policy: one day\'s salary is deducted for each late mark beyond the allowed 4.';

export const OFFICES: Office[] = [
  { id: 'indore', name: 'Indore (BT Office)', tzLabel: 'IST', timeZone: 'Asia/Kolkata', source: 'Punch system export', departments: ['AMIPI - BT OFFICE'],
    mode: 'punch', weeklyOff: [0, 6], graceMinutes: 15, lateAllowance: 4, lateBeyondNote: NY_BEYOND },
  { id: 'remote', name: 'Remote', tzLabel: 'IST', timeZone: 'Asia/Kolkata', source: 'Punch system export', departments: ['AMIPI REMOTE'],
    mode: 'punch', weeklyOff: [0, 6], graceMinutes: 15, lateAllowance: 4, lateBeyondNote: NY_BEYOND },
  { id: 'mumbai', name: 'Mumbai', tzLabel: 'IST', timeZone: 'Asia/Kolkata', source: 'Monthly attendance sheet', departments: [],
    mode: 'sheet', weeklyOff: [0], graceMinutes: 20, lateAllowance: 4, lateBeyondNote: 'Mumbai allows 4 late marks a month. A late with overtime that day is not marked.' },
  { id: 'newyork', name: 'New York', tzLabel: 'ET', timeZone: 'America/New_York', source: 'HR emails only (no attendance system)', departments: [],
    mode: 'emails', weeklyOff: [0, 6], graceMinutes: 15, lateAllowance: 4, lateBeyondNote: NY_BEYOND },
];

export const CALENDARS: (Calendar & { sort: number })[] = [
  { id: 'us', name: 'US holidays', description: 'AMIPI INC paid holidays. New York office and remote team.', sort: 1 },
  { id: 'ny-shift', name: 'NY shift (India)', description: 'India staff working New York hours: US holidays plus Diwali.', sort: 2 },
  { id: 'india-day', name: 'India day shift', description: 'Staff on the D (day) shift.', sort: 3 },
  { id: 'mumbai', name: 'Mumbai office', description: 'Mumbai office holidays.', sort: 4 },
];

// 2026 dates worked out from the lists HR shared on 21 Oct 2026. Names ending in "(confirm date)" need checking.
export const HOLIDAYS: Record<string, [string, string][]> = {
  us: [
    ['2026-01-01', "New Year's Day"], ['2026-05-25', 'Memorial Day'], ['2026-07-04', 'Independence Day'],
    ['2026-09-07', 'Labor Day'], ['2026-11-26', 'Thanksgiving'], ['2026-12-25', 'Christmas Day'],
  ],
  'ny-shift': [
    ['2026-01-02', "New Year's Day (observed)"], ['2026-05-25', 'Memorial Day'], ['2026-07-04', 'Independence Day'],
    ['2026-09-07', 'Labor Day'], ['2026-11-08', 'Diwali'], ['2026-11-26', 'Thanksgiving'], ['2026-12-25', 'Christmas Day'],
  ],
  'india-day': [
    ['2026-01-02', "New Year's Day (observed)"], ['2026-03-04', 'Holi'], ['2026-08-15', 'Independence Day'],
    ['2026-08-28', 'Raksha Bandhan'], ['2026-10-02', 'Gandhi Jayanti'], ['2026-11-08', 'Diwali'], ['2026-12-25', 'Christmas Day'],
  ],
  mumbai: [
    ['2026-01-26', 'Republic Day'], ['2026-03-04', 'Holi'], ['2026-05-01', 'Labour Day'], ['2026-08-15', 'Independence Day'],
    ['2026-08-28', 'Raksha Bandhan'], ['2026-10-02', 'Gandhi Jayanti'],
    ['2026-11-09', 'Diwali week (confirm date)'], ['2026-11-10', 'Diwali week (confirm date)'], ['2026-11-11', 'Diwali week (confirm date)'],
    ['2026-11-12', 'Diwali week (confirm date)'], ['2026-11-13', 'Diwali week (confirm date)'],
  ],
};

// Shift codes. G (Full Time, 9:30-18:30 IST) and NY (9:15-18:15 ET, from the signed NY attendance rules) are
// confirmed. The others are estimated from September 2026 punch data and need confirming (D: from Lokesh).
export const SHIFTS: [code: string, name: string, start: number, end: number, confirmed: boolean][] = [
  ['G', 'Full Time', 570, 1110, true], ['D', 'Day Time', 225, 765, false], ['S1', 'Shift S1', 450, 990, false],
  ['E1', 'Shift E1', 540, 1080, false], ['E4', 'Shift E4 (short day)', 600, 990, false], ['G2', 'Shift G2', 540, 1110, false],
  ['P1', 'Shift P1', 645, 1185, false], ['NY', 'New York office', 555, 1095, true], ['MUM', 'Mumbai office', 600, 1140, false],
];

export const RULES: Settings = {
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
  closeDay: 3,
  reportRecipients: [],
  weeklyOff: [0, 6],
  punchFileName: 'monthdatewiseperformance',
};
