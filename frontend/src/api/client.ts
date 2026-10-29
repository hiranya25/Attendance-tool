import type { Connections, Employee, Holiday, ImportRecord, MonthData, Reference, Settings, Shift, TrendPoint, User } from '../types';

export interface ImportResult { months: string[]; people: number; days: number; newPeople: string[] }

/**
 * Everything the screens need from the server. The demo uses `mockApi`; the real server is `httpApi`.
 */
export interface AttendanceApi {
  session(): Promise<{ user: User | null; needsSetup: boolean }>;
  setup(name: string, email: string, password: string): Promise<User>;
  login(email: string, password: string): Promise<User>;
  logout(): Promise<void>;

  getReference(): Promise<Reference>;
  getMonth(month: string): Promise<MonthData>;
  getTrend(): Promise<TrendPoint[]>;
  connections(): Promise<Connections>;
  listImports(): Promise<ImportRecord[]>;

  saveSettings(settings: Settings): Promise<void>;
  saveHolidays(holidays: Holiday[]): Promise<void>;
  saveShifts(shifts: Shift[]): Promise<void>;
  saveEmployee(id: string, changes: Partial<Employee>): Promise<void>;
  uploadImport(file: File): Promise<ImportResult>;
  buildPackage(month: string): Promise<{ version: number }>;
  runJobs(): Promise<string[]>;

  listUsers(): Promise<User[]>;
  addUser(u: { name: string; email: string; password: string; role: string }): Promise<void>;
  removeUser(id: number): Promise<void>;

  /** Link to an Excel download, or null when downloads come from the browser instead (demo). */
  exportUrl(month: string, part: 'all' | 'master' | 'issues'): string | null;
  reportUrl(id: number): string | null;
}
