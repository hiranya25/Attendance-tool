import type { AttendanceApi } from './client';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** The real server. `base` is the API path, normally "api" (relative, so the app also works in a sub-folder). */
export function httpApi(base: string): AttendanceApi {
  const root = base.replace(/\/$/, '');
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(root + path, {
      credentials: 'same-origin',
      ...init,
      headers: { 'X-Requested-With': 'AttendanceDesk', ...(init.body && !(init.body instanceof File) ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) throw new ApiError(res.status, data?.error ?? `${res.status} ${res.statusText}`);
    return data as T;
  }
  const put = (body: unknown) => ({ method: 'PUT', body: JSON.stringify(body) });
  const post = (body?: unknown) => ({ method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
  return {
    session: () => call('/session'),
    setup: async (name, email, password) => (await call<{ user: never }>('/setup', post({ name, email, password }))).user,
    login: async (email, password) => (await call<{ user: never }>('/login', post({ email, password }))).user,
    logout: () => call('/logout', post()),
    changePassword: (current, password) => call('/me/password', put({ current, password })),
    getReference: () => call('/reference'),
    getMonth: (month) => call(`/months/${month}`),
    getTrend: () => call('/trend'),
    getHistory: () => call('/history'),
    connections: () => call('/connections'),
    listImports: () => call('/imports'),
    getNotification: (id) => call(`/notifications/${encodeURIComponent(id)}`),
    saveSettings: (s) => call('/settings', put(s)),
    saveHolidays: (h) => call('/holidays', put(h)),
    saveShifts: (s) => call('/shifts', put(s)),
    saveOffices: (o) => call('/offices', put(o)),
    saveEmployee: (id, changes) => call(`/employees/${encodeURIComponent(id)}`, put(changes)),
    uploadImport: (file) => call('/imports', { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) } }),
    buildPackage: (month) => call(`/months/${month}/package`, post()),
    runJobs: async () => (await call<{ lines: string[] }>('/jobs/run', post())).lines,
    listUsers: () => call('/users'),
    addUser: (u) => call('/users', post(u)),
    removeUser: (id) => call(`/users/${id}`, { method: 'DELETE' }),
    resetPassword: (id, password) => call(`/users/${id}/password`, put({ password })),
    exportUrl: (month, part) => `${root}/months/${month}/export?part=${part}`,
    reportUrl: (id, format = 'xlsx') => `${root}/reports/${id}/download${format === 'pdf' ? '?format=pdf' : ''}`,
    pdfUrl: (month) => `${root}/months/${month}/report.pdf`,
  };
}
