import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, usingSampleData } from './api';
import { Ctx, type AppState, type DrawerTarget } from './store';
import type { Employee, MonthData, Office, Reference, TrendPoint, User } from './types';
import { fmtDay, fmtMonth } from './lib/format';
import { needsAttention } from './lib/stats';
import { Overview } from './pages/Overview';
import { Attendance } from './pages/Attendance';
import { Issues } from './pages/Issues';
import { Emails } from './pages/Emails';
import { Changes } from './pages/Changes';
import { Reminders } from './pages/Reminders';
import { Reports } from './pages/Reports';
import { People } from './pages/People';
import { Rules } from './pages/Rules';
import { DrawerHost } from './pages/Drawers';
import { Files } from './pages/Files';
import { History } from './pages/History';
import { Login } from './pages/Login';
import { Settings, initials } from './pages/Settings';

const VIEWS = [
  { id: 'overview', label: 'Overview', page: Overview },
  { id: 'attendance', label: 'Attendance', page: Attendance },
  { id: 'issues', label: 'Issues', page: Issues },
  { id: 'files', label: 'Attendance files', page: Files },
  { id: 'emails', label: 'HR emails', page: Emails },
  { id: 'changes', label: 'Change log', page: Changes },
  { id: 'reminders', label: 'Emails sent', page: Reminders },
  { id: 'reports', label: 'Monthly report', page: Reports },
  { id: 'history', label: 'Past months', page: History },
  { id: 'people', label: 'People', page: People },
  { id: 'rules', label: 'Rules & calendars', page: Rules },
  { id: 'settings', label: 'Settings', page: Settings },
] as const;

const viewFromHash = () => {
  const h = location.hash.replace('#', '');
  return VIEWS.some((v) => v.id === h) ? h : 'overview';
};

export function App() {
  const [ref, setRef] = useState<Reference | null>(null);
  const [month, setMonth] = useState('');
  const [data, setData] = useState<MonthData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [view, setView] = useState(viewFromHash);
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [toastText, setToastText] = useState('');
  const [error, setError] = useState('');
  const [session, setSession] = useState<{ user: User | null; needsSetup: boolean } | null>(null);

  useEffect(() => {
    const on = () => { setView(viewFromHash()); setDrawer(null); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const load = useCallback(async (m?: string) => {
    try {
      const r = await api.getReference();
      const target = m || r.latestDataMonth || r.months[r.months.length - 1];
      const [d, t] = await Promise.all([api.getMonth(target), api.getTrend()]);
      setRef(r); setMonth(target); setData(d); setTrend(t); setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    api.session().then(setSession).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(() => { if (session?.user) void load(); }, [session, load]);

  const toast = useCallback((t: string) => {
    setToastText(t);
    window.setTimeout(() => setToastText((cur) => (cur === t ? '' : cur)), 2800);
  }, []);

  const go = useCallback((v: string) => { location.hash = v; window.scrollTo(0, 0); }, []);

  const state: AppState | null = useMemo(() => {
    if (!ref || !data) return null;
    const empMap = new Map(ref.employees.map((e) => [e.id, e]));
    const offMap = new Map(ref.offices.map((o) => [o.id, o]));
    return {
      ref, month, data, trend, go, toast,
      setMonth: (m) => void load(m),
      reload: () => load(month),
      signOut: async () => { await api.logout(); setSession({ user: null, needsSetup: false }); setRef(null); setData(null); },
      open: setDrawer,
      emp: (id) => empMap.get(id) as Employee,
      office: (id) => offMap.get(id) as Office,
    };
  }, [ref, data, month, trend, load, go, toast]);

  if (error) {
    return (
      <div className="boot">
        <h1>Could not load attendance data</h1>
        <p>{error}</p>
        <p className="muted">Check that the backend is running and that VITE_API_URL points to it, then reload the page.</p>
      </div>
    );
  }
  if (session && !session.user) return <Login firstRun={session.needsSetup} onDone={(user) => setSession({ user, needsSetup: false })} />;
  if (!state || !data) return <div className="boot muted">Loading attendance…</div>;

  const Page = VIEWS.find((v) => v.id === view)?.page ?? Overview;
  const counts: Record<string, number> = {
    issues: data.issues.filter(needsAttention).length,
    emails: data.emails.filter((m) => m.outcome === 'unclear').length,
  };

  return (
    <Ctx.Provider value={state}>
      <div className="app">
        <nav className="rail" aria-label="Sections">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <i /><i /><i /><i />
            </span>
            <span>Attendance Desk<small>Indore · Mumbai · New York · Remote</small></span>
          </div>
          {VIEWS.map((v) => (
            <a key={v.id} href={`#${v.id}`} className={view === v.id ? 'on' : ''} aria-current={view === v.id ? 'page' : undefined}>
              {v.label}
              {counts[v.id] ? <span className="count">{counts[v.id]}</span> : null}
            </a>
          ))}
          <div className="rail-foot">
            <span className="live"><i />Runs by itself</span>
            Checks for new emails and files every 15 minutes. No approvals needed.
          </div>
        </nav>
        <div className="main">
          <div className="topbar">
            <label className="month-pick">
              <span className="sr">Month</span>
              <select id="month" value={month} onChange={(e) => state.setMonth(e.target.value)}>
                {[...state.ref.months].reverse().map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}
              </select>
            </label>
            <span className="muted small">
              {data.close.closed ? `Closed ${fmtDay(data.close.closesAt)}` : `Data up to ${fmtDay(data.dataThrough)}`}
            </span>
            <span className="grow" />
            {usingSampleData && <span className="pill t-warn" title="Names and numbers are invented for the demo">Sample data</span>}
            {state.ref.user && <UserMenu user={state.ref.user} onSettings={() => go('settings')} onSignOut={() => void state.signOut()} />}
          </div>
          <main>
            <Page />
          </main>
        </div>
      </div>
      {drawer && <DrawerHost target={drawer} onClose={() => setDrawer(null)} />}
      {toastText && <div className="toast" role="status">{toastText}</div>}
    </Ctx.Provider>
  );
}

/** The signed-in person's initials. Click for their name, Settings and Sign out. */
function UserMenu({ user, onSettings, onSignOut }: { user: User; onSettings: () => void; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const pick = (f: () => void) => () => { setOpen(false); f(); };
  return (
    <div className="user-menu" ref={box}>
      <button className="avatar" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        title={`Signed in as ${user.name}`} aria-label={`Account menu for ${user.name}`}>
        {initials(user.name)}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-who">
            <b>{user.name}</b>
            <span className="sub mono">{user.email}</span>
            <span className="sub">{user.role === 'admin' ? 'Admin' : 'Viewer'}</span>
          </div>
          <button type="button" role="menuitem" onClick={pick(onSettings)}>Settings</button>
          <button type="button" role="menuitem" className="danger" onClick={pick(onSignOut)}>Sign out</button>
        </div>
      )}
    </div>
  );
}
