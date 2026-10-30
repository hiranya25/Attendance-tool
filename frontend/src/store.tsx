import { createContext, useContext } from 'react';
import type { Employee, MonthData, Office, Reference, TrendPoint } from './types';

export type DrawerTarget =
  | { kind: 'issue'; id: string }
  | { kind: 'day'; employeeId: string; date: string }
  | { kind: 'person'; employeeId: string }
  | { kind: 'email'; id: string }
  | { kind: 'account' }
  | { kind: 'message'; id: string };

export interface AppState {
  ref: Reference;
  month: string;
  setMonth: (m: string) => void;
  data: MonthData;
  trend: TrendPoint[];
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
  open: (t: DrawerTarget) => void;
  go: (view: string) => void;
  toast: (text: string) => void;
  emp: (id: string) => Employee;
  office: (id: string) => Office;
}

export const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}
