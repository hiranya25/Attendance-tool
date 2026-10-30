// Light, dark, or follow the computer's setting. Remembered in this browser only.

export type Theme = '' | 'light' | 'dark';
const KEY = 'attendance-desk-theme';

export function savedTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : '';
  } catch {
    return '';
  }
}

export function applyTheme(t: Theme) {
  if (t) document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem(KEY, t); } catch { /* private window: works for this visit only */ }
}
