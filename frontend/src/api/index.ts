import type { AttendanceApi } from './client';
import { httpApi } from './http';
import { mockApi } from '../mock/mockApi';

const base = import.meta.env.VITE_API_URL as string | undefined;

export const api: AttendanceApi = base ? httpApi(base) : mockApi;
export const usingSampleData = !base;
