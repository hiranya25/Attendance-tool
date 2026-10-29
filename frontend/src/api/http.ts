import type { AttendanceApi } from './client';

// Used when VITE_API_URL is set. Endpoint names are the contract for the backend.
export function httpApi(base: string): AttendanceApi {
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(base.replace(/\/$/, '') + path, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
    return res.status === 204 ? (undefined as T) : res.json();
  }
  return {
    getReference: () => call('/reference'),
    getMonth: (month) => call(`/months/${month}`),
    getTrend: () => call('/trend'),
    saveSettings: (settings) => call('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
    saveHolidays: (holidays) => call('/holidays', { method: 'PUT', body: JSON.stringify(holidays) }),
  };
}
