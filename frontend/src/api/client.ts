import type { Connections, Employee, Holiday, ImportRecord, MonthData, MonthSummary, Office, Reference, Settings, Shift, TrendPoint, User } from '../types';

export interface ImportResult {
  kind?: 'punch' | 'sheet' | 'team';
  months: string[];
  people: number;
  days: number;
  newPeople: string[];
  team?: { added: string[]; updated: string[]; notTracked: string[]; notOnList: string[] };
}

/**
 * Everything the screens need from the server. The demo uses `mockApi`; the real server is `httpApi`.
 */
export interface AttendanceApi {
  session(): Promise<{ user: User | null; needsSetup: boolean }>;
  setup(name: string, email: string, password: string): Promise<User>;
  login(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
  changePassword(current: string, password: string): Promise<void>;

  getReference(): Promise<Reference>;
  getMonth(month: string): Promise<MonthData>;
  getTrend(): Promise<TrendPoint[]>;
  getHistory(): Promise<MonthSummary[]>;
  connections(): Promise<Connections>;
  listImports(): Promise<ImportRecord[]>;
  getNotification(id: string): Promise<{ subject: string; to: string; at: string; sent: boolean; error: string | null; html: string }>;

  saveSettings(settings: Settings): Promise<void>;
  saveHolidays(holidays: Holiday[]): Promise<void>;
  saveShifts(shifts: Shift[]): Promise<void>;
  saveOffices(offices: Office[]): Promise<void>;
  saveEmployee(id: string, changes: Partial<Employee>): Promise<void>;
  uploadImport(file: File): Promise<ImportResult>;
  buildPackage(month: string): Promise<{ version: number }>;
  runJobs(): Promise<string[]>;

  listUsers(): Promise<User[]>;
  addUser(u: { name: string; email: string; password: string; role: string }): Promise<void>;
  removeUser(id: number): Promise<void>;
  resetPassword(id: number, password: string): Promise<void>;

  /** Link to an Excel download, or null when downloads come from the browser instead (demo). */
  exportUrl(month: string, part: 'all' | 'master' | 'issues'): string | null;
  reportUrl(id: number): string | null;
}
