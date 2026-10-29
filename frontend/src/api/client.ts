import type { Holiday, MonthData, Reference, Settings, TrendPoint } from '../types';

/**
 * Everything the screens need from the backend. The demo uses `mockApi`;
 * the real backend only has to implement this interface (see `httpApi`).
 */
export interface AttendanceApi {
  getReference(): Promise<Reference>;
  getMonth(month: string): Promise<MonthData>;
  getTrend(): Promise<TrendPoint[]>;
  saveSettings(settings: Settings): Promise<void>;
  saveHolidays(holidays: Holiday[]): Promise<void>;
}
