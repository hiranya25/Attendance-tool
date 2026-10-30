import type { AttendanceApi } from './client';
import { httpApi } from './http';
import { mockApi } from '../mock/mockApi';

// Built with VITE_API_URL=api for the real server (see frontend/README.md). Without it, the app runs on sample data.
const base = import.meta.env.VITE_API_URL as string | undefined;

export const api: AttendanceApi = base ? httpApi(base) : mockApi;
export const usingSampleData = !base;
