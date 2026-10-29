const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

export function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function dayOfWeek(iso: string) {
  const { y, m, d } = parts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysInMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthDates(month: string) {
  const [y, m] = month.split('-').map(Number);
  return Array.from({ length: daysInMonth(month) }, (_, i) => isoDate(y, m, i + 1));
}

export function addDays(iso: string, n: number) {
  const { y, m, d } = parts(iso);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return isoDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function nextMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** "Wed 28 Oct" */
export function fmtDay(iso: string) {
  const { m, d } = parts(iso);
  return `${DOW[dayOfWeek(iso)]} ${d} ${MON[m - 1]}`;
}

/** "28 Oct" */
export function fmtShort(iso: string) {
  const { m, d } = parts(iso);
  return `${d} ${MON[m - 1]}`;
}

/** "October 2026" */
export function fmtMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_LONG[m - 1]} ${y}`;
}

export function fmtMonthShort(month: string) {
  const [, m] = month.split('-').map(Number);
  return MON[m - 1];
}

/** "Wed 28 Oct, 09:14" from "2026-10-28T09:14" */
export function fmtWhen(iso: string) {
  return `${fmtDay(iso)}, ${iso.slice(11, 16)}`;
}

export function dowLetter(iso: string) {
  return DOW[dayOfWeek(iso)][0];
}

/** minutes after midnight -> "09:30" */
export function hm(min: number | null | undefined) {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  return `${String(h).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** "09:30" -> minutes */
export function parseHm(s: string) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** minutes -> "7h 42m" */
export function dur(min: number | null | undefined) {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** minutes -> "162:30" (the h:mm style used in the attendance exports) */
export function hhmm(min: number) {
  return `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;
}

export function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

export function plural(n: number, one: string, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}
