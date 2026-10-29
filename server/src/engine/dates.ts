const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const parts = (iso: string) => iso.slice(0, 10).split('-').map(Number) as [number, number, number];
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function monthDates(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => iso(y, m, i + 1));
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = parts(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function dow(date: string): number {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Minutes from one clock time to the next, across midnight when needed. */
export function span(from: number, to: number): number {
  const d = to - from;
  return d < 0 ? d + 1440 : d;
}

/** Signed difference to - from, the shorter way round the clock. */
export function diff(from: number, to: number): number {
  let d = to - from;
  if (d > 720) d -= 1440;
  if (d <= -720) d += 1440;
  return d;
}

export function hm(min: number | null | undefined): string {
  if (min == null) return '—';
  return `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function hhmm(min: number): string {
  return `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;
}

export function dur(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "28 Oct" */
export function short(date: string): string {
  const [, m, d] = parts(date);
  return `${d} ${MON[m - 1]}`;
}

/** "Wed 28 Oct" */
export function day(date: string): string {
  return `${DOW[dow(date)]} ${short(date)}`;
}

/** "Wed 28 Oct, 09:14" */
export function when(at: string): string {
  return at.length > 10 ? `${day(at)}, ${at.slice(11, 16)}` : day(at);
}

/** "September 2026" */
export function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_LONG[m - 1]} ${y}`;
}
