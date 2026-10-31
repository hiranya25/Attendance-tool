import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, usingSampleData } from '../api';
import { resetDemo } from '../mock/mockApi';
import { useApp } from '../store';
import { Empty, PageHead, Panel, Pill } from '../components/ui';
import { fmtDay, fmtWhen, hm, parseHm } from '../lib/format';
import type { Connections, Holiday, Office, Settings, Shift, User } from '../types';
import { PASSWORD_RULE, passwordProblem } from '../lib/password';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Rules() {
  const { ref, reload, toast } = useApp();
  const isAdmin = ref.user?.role === 'admin';
  const [s, setS] = useState<Settings>(ref.settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setS(ref.settings), [ref.settings]);
  const dirty = JSON.stringify(s) !== JSON.stringify(ref.settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.saveSettings(s);
      await reload();
      toast('Saved. Every month was checked again with the new rules.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Rules & calendars"
        sub="The tool follows these rules on its own. Change a value and save, and every month is checked again. Each change is written to the change log."
        actions={isAdmin && (
          <>
            {usingSampleData && <button className="btn sm" onClick={async () => { resetDemo(); await reload(); toast('Demo reset to the starting rules'); }}>Reset demo</button>}
            <button className="btn sm pri" disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save rule changes'}</button>
          </>
        )}
      />
      {dirty && <p className="note">You have unsaved rule changes.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <fieldset className="rules" disabled={!isAdmin}>
        <div className="rules-inner">
        <ConnectionsPanel />
        <OfficesPanel />
        <ShiftsPanel />

        <div className="two">
          <Panel title="Daily checks" note="What counts as early, short, a long absence or a likely system issue. Late grace, late allowance and weekly offs are set per office above.">
            <div className="form">
              <Num id="early" label="Early departure when leaving more than" unit="min before shift end" value={s.earlyToleranceMinutes} onChange={(v) => set('earlyToleranceMinutes', v)} />
              <Num id="short" label="Short hours when below scheduled by more than" unit="min" value={s.shortHoursToleranceMinutes} onChange={(v) => set('shortHoursToleranceMinutes', v)} />
              <Num id="long" label="Long absence from" unit="working days in a row" value={s.longAbsenceDays} min={2} onChange={(v) => set('longAbsenceDays', v)} />
              <Num id="sys" label="Likely system issue when the same gap hits" unit="people in one office, one day" value={s.systemIssueMinPeople} min={2} onChange={(v) => set('systemIssueMinPeople', v)} />
            </div>
          </Panel>

          <Panel title="HR emails" note="Emails to hr@amipi.com are read and applied to attendance (leave, half days, late or early notes). Nothing is sent during the month unless you turn it on below; everything goes into the month-end report.">
            <div className="form">
              <Num id="conf" label="Apply an email when match confidence is at least" unit="%" value={s.autoApplyConfidence} min={50} max={100} onChange={(v) => set('autoApplyConfidence', v)} />
              <Field label="Emails during the month (reminders to employees, alerts to HR)">
                <label className="switch" htmlFor="rem-on"><input id="rem-on" type="checkbox" checked={s.remindersOn} onChange={(e) => set('remindersOn', e.target.checked)} /> {s.remindersOn ? 'On' : 'Off: month-end report only'}</label>
              </Field>
              {s.remindersOn && (
                <>
                  <Field label="HR mailbox (gets alerts and the daily summary)"><input id="hr-email" type="email" value={s.hrEmail} onChange={(e) => set('hrEmail', e.target.value)} /></Field>
                  <Num id="rem-days" label="Send the reminder after" unit="working days" value={s.reminderAfterDays} min={1} max={10} onChange={(v) => set('reminderAfterDays', v)} />
                  <Num id="rem-window" label="Only remind about days in the last" unit="days (older ones go in the report only)" value={s.reminderWindowDays} min={1} max={60} onChange={(v) => set('reminderWindowDays', v)} />
                </>
              )}
              <Field label="HR daily summary email">
                <span className="row-gap">
                  <label className="switch" htmlFor="digest-on"><input id="digest-on" type="checkbox" checked={s.hrDigestOn} onChange={(e) => set('hrDigestOn', e.target.checked)} /> {s.hrDigestOn ? 'On, at' : 'Off'}</label>
                  {s.hrDigestOn && <input id="digest" type="time" aria-label="Summary time" value={s.hrDigestTime} onChange={(e) => e.target.value && set('hrDigestTime', e.target.value)} />}
                </span>
              </Field>
            </div>
          </Panel>
        </div>

        <Panel title="Month close and reports" note="The month closes by itself. The PDF report (with charts and the comparison with the previous month) and the attendance Excel are saved here and emailed to the addresses below. If a newer file arrives later, a revised version goes out.">
          <div className="form wide-form">
            <Num id="close" label="Close the month on day" unit="of the next month, or when its file arrives if later" value={s.closeDay} min={1} max={28} onChange={(v) => set('closeDay', v)} />
            <Field label="Email the monthly package to (one address per line)">
              <textarea id="recips" rows={4} value={s.reportRecipients.join('\n')} onChange={(e) => set('reportRecipients', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} placeholder="name@amipi.com" />
            </Field>
            <Field label="Import email attachments whose file name contains">
              <input id="punch-name" type="text" value={s.punchFileName} onChange={(e) => set('punchFileName', e.target.value)} />
            </Field>
          </div>
        </Panel>

        </div>
      </fieldset>
      <Holidays />
      {isAdmin && !usingSampleData && <Users />}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><span>{label}</span>{children}</div>;
}

function Num({ id, label, unit, value, onChange, step = 1, min = 0, max }: { id: string; label: string; unit: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <span className="num-in">
        <input id={id} type="number" value={value} step={step} min={min} max={max} onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))} />
        <span className="muted small">{unit}</span>
      </span>
    </div>
  );
}

function ConnectionsPanel() {
  const { ref, reload, toast } = useApp();
  const [c, setC] = useState<Connections | null>(null);
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[] | null>(null);
  useEffect(() => { api.connections().then(setC).catch(() => setC(null)); }, []);
  async function runNow() {
    setRunning(true);
    try {
      setLines(await api.runJobs());
      await reload();
      toast('Checks finished');
    } catch (e) {
      setLines([(e as Error).message]);
    } finally {
      setRunning(false);
    }
  }
  const item = (ok: boolean, label: string, okText: string, offText: string) => (
    <li className="list-row static"><span className="grow"><b>{label}</b><span className="sub">{ok ? okText : offText}</span></span><Pill tone={ok ? 'ok' : 'warn'}>{ok ? 'Connected' : 'Not set up'}</Pill></li>
  );
  return (
    <Panel
      title="Connections"
      note={c?.lastRun ? `Last automatic run ${fmtWhen(c.lastRun)}. Runs every 15 minutes.` : 'The automatic run has not happened yet. It starts once the cron job is set up on the server.'}
      actions={ref.user?.role === 'admin' && <button className="btn sm" type="button" onClick={runNow} disabled={running}>{running ? 'Running…' : 'Run checks now'}</button>}
      flush
    >
      {c ? (
        <ul className="list">
          {item(c.microsoft, `Outlook mailbox ${c.mailbox}`, 'Receives a copy of everything sent to the hr@ group. The tool reads it, and sends reminders and reports from it.', 'Add the Microsoft 365 app details to config.json on the server. See docs/DEPLOY.md.')}
          {item(c.ai, `AI email reader: ${c.aiName}`, 'Works out the person, days and type of each email.', 'Add the AI API key to config.json on the server (see docs/DEPLOY.md, step 7).')}
          {item(c.sendEmail, 'Sending email', 'Reminders, HR summaries and monthly reports are sent.', 'Turned off in config.json. Messages are recorded on the Reminders page but not sent.')}
        </ul>
      ) : <Empty>Connection status is not available.</Empty>}
      {(lines ?? c?.lastRunLog)?.length ? <pre className="log">{(lines ?? c?.lastRunLog ?? []).join('\n')}</pre> : null}
    </Panel>
  );
}

const MODE_LABEL = { punch: 'Punch system export', sheet: 'Monthly sheet (OK / L1 / A)', emails: 'HR emails only' } as const;

/** Each office's own rules: weekly off days, late grace, and late marks allowed per month. */
function OfficesPanel() {
  const { ref, reload, toast } = useApp();
  const [rows, setRows] = useState<Office[]>(ref.offices);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setRows(ref.offices), [ref.offices]);
  const dirty = JSON.stringify(rows) !== JSON.stringify(ref.offices);
  const edit = (i: number, patch: Partial<Office>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.saveOffices(rows);
      await reload();
      toast('Office rules saved. Every month was checked again.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title="Offices"
      note="Each office's attendance source and rules. Late marks up to the allowance are shown as “Within allowance”; each one after that is flagged."
      actions={<button className="btn sm pri" type="button" disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save office rules'}</button>}
      flush
    >
      {error && <p className="error inset" role="alert">{error}</p>}
      <div className="scroll">
        <table>
          <thead><tr><th>Office</th><th>Attendance from</th><th>Weekly off</th><th>Late grace (min)</th><th>Late marks allowed / month</th><th>After the allowance</th></tr></thead>
          <tbody>
            {rows.map((o, i) => (
              <tr key={o.id}>
                <td className="nowrap"><b>{o.name}</b> <span className="muted small">{o.tzLabel}</span></td>
                <td className="small">{MODE_LABEL[o.mode ?? 'punch']}</td>
                <td>
                  <div className="chips" role="group" aria-label={`${o.name} weekly off`}>
                    {DAYS.map((d, n) => {
                      const on = (o.weeklyOff ?? []).includes(n);
                      return <button key={d} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on}
                        onClick={() => edit(i, { weeklyOff: on ? (o.weeklyOff ?? []).filter((x) => x !== n) : [...(o.weeklyOff ?? []), n].sort() })}>{d}</button>;
                    })}
                  </div>
                </td>
                <td><input id={`og-${o.id}`} type="number" min={0} max={240} aria-label={`${o.name} late grace`} value={o.graceMinutes ?? 15} onChange={(e) => e.target.value !== '' && edit(i, { graceMinutes: Number(e.target.value) })} className="num-small" /></td>
                <td><input id={`oa-${o.id}`} type="number" min={0} max={31} aria-label={`${o.name} late marks allowed`} value={o.lateAllowance ?? 0} onChange={(e) => e.target.value !== '' && edit(i, { lateAllowance: Number(e.target.value) })} className="num-small" /></td>
                <td><input id={`on-${o.id}`} type="text" aria-label={`${o.name} rule after the allowance`} value={o.lateBeyondNote ?? ''} onChange={(e) => edit(i, { lateBeyondNote: e.target.value })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ShiftsPanel() {
  const { ref, reload, toast } = useApp();
  const [rows, setRows] = useState<Shift[]>(ref.shifts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setRows(ref.shifts), [ref.shifts]);
  const dirty = JSON.stringify(rows) !== JSON.stringify(ref.shifts);
  const edit = (i: number, patch: Partial<Shift>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const unconfirmed = ref.shifts.filter((x) => !x.confirmed).length;
  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.saveShifts(rows);
      await reload();
      toast('Shift times saved. Every month was checked again.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const count = (code: string) => ref.employees.filter((e) => e.shiftCode === code).length;
  return (
    <Panel
      title="Shift timings"
      note="Shift codes come from the punch system. Late, early and short hours are measured against these times."
      actions={<button className="btn sm pri" type="button" disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save shift times'}</button>}
      flush
    >
      {unconfirmed > 0 && <p className="note inset">{unconfirmed} shift {unconfirmed === 1 ? 'time is' : 'times are'} estimated from September data. Check them with Jainam, correct them here, and tick “Confirmed”.</p>}
      {error && <p className="error inset" role="alert">{error}</p>}
      <div className="scroll">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Starts</th><th>Ends</th><th className="num">People</th><th>Confirmed</th></tr></thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={x.code}>
                <td className="mono"><b>{x.code}</b></td>
                <td><input id={`sh-name-${x.code}`} type="text" aria-label={`Name of shift ${x.code}`} value={x.name} onChange={(e) => edit(i, { name: e.target.value })} /></td>
                <td><input id={`sh-start-${x.code}`} type="time" aria-label={`Start of shift ${x.code}`} value={hm(x.start)} onChange={(e) => e.target.value && edit(i, { start: parseHm(e.target.value) })} /></td>
                <td><input id={`sh-end-${x.code}`} type="time" aria-label={`End of shift ${x.code}`} value={hm(x.end)} onChange={(e) => e.target.value && edit(i, { end: parseHm(e.target.value) })} /></td>
                <td className="num">{count(x.code)}</td>
                <td><label className="switch" htmlFor={`sh-ok-${x.code}`}><input id={`sh-ok-${x.code}`} type="checkbox" checked={x.confirmed} onChange={(e) => edit(i, { confirmed: e.target.checked })} /> {x.confirmed ? 'Yes' : <span className="muted">Estimated</span>}</label></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Holidays() {
  const { ref, reload, toast } = useApp();
  const isAdmin = ref.user?.role === 'admin';
  const [cal, setCal] = useState(ref.calendars[0]?.id ?? '');
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const current = ref.calendars.find((c) => c.id === cal);
  const list = ref.holidays.filter((h) => h.calendar === cal).sort((a, b) => a.date.localeCompare(b.date));
  const people = ref.employees.filter((e) => e.calendarId === cal).length;

  async function saveList(next: Holiday[], msg: string) {
    setError('');
    try {
      await api.saveHolidays(next);
      await reload();
      toast(msg);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Panel
      title="Holiday calendars"
      note={current ? `${current.description} ${people} ${people === 1 ? 'person uses' : 'people use'} this calendar. Holidays are never counted as absences.` : undefined}
      actions={
        <div className="chips" role="group" aria-label="Calendar">
          {ref.calendars.map((c) => <button key={c.id} type="button" className={`chip${cal === c.id ? ' on' : ''}`} onClick={() => setCal(c.id)}>{c.name}</button>)}
        </div>
      }
      flush
    >
      {error && <p className="error inset" role="alert">{error}</p>}
      <div className="scroll">
        <table>
          <thead><tr><th>Date</th><th>Holiday</th><th /></tr></thead>
          <tbody>
            {list.map((h) => (
              <tr key={h.date + h.name}>
                <td className="nowrap">{fmtDay(h.date)} {h.date.slice(0, 4)}</td>
                <td>{h.name} {/confirm/i.test(h.name) && <Pill tone="warn">Check date</Pill>}</td>
                <td className="num">{isAdmin && <button type="button" className="btn sm ghost" onClick={() => saveList(ref.holidays.filter((x) => x !== h), `Removed ${h.name}`)}>Remove</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isAdmin && <form className="add-row" onSubmit={(e: FormEvent) => { e.preventDefault(); if (date && name.trim()) { void saveList([...ref.holidays, { date, name: name.trim(), calendar: cal }], `Added ${name.trim()}`); setDate(''); setName(''); } }}>
        <label htmlFor="hol-date" className="sr">Date</label>
        <input id="hol-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <label htmlFor="hol-name" className="sr">Holiday name</label>
        <input id="hol-name" type="text" placeholder="Holiday name" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className="btn sm" type="submit">Add to {current?.name ?? 'calendar'}</button>
      </form>}
    </Panel>
  );
}

function Users() {
  const { ref, toast } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer' });
  const [error, setError] = useState('');
  const [resetFor, setResetFor] = useState<number | null>(null);
  const [newPw, setNewPw] = useState('');
  const [removeFor, setRemoveFor] = useState<number | null>(null);
  const refresh = () => api.listUsers().then(setUsers).catch(() => setUsers([]));
  useEffect(() => { void refresh(); }, []);
  const run = async (fn: () => Promise<void>) => {
    setError('');
    try { await fn(); } catch (err) { setError((err as Error).message); }
  };
  async function add(e: FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(form.password);
    if (problem) { setError(problem); return; }
    await run(async () => {
      await api.addUser(form);
      setForm({ name: '', email: '', password: '', role: 'viewer' });
      toast('Account added');
      await refresh();
    });
  }
  async function reset(e: FormEvent, u: User) {
    e.preventDefault();
    const problem = passwordProblem(newPw);
    if (problem) { setError(problem); return; }
    await run(async () => {
      await api.resetPassword(u.id, newPw);
      setResetFor(null);
      setNewPw('');
      toast(`New password set for ${u.name}. Tell them, and ask them to change it in Settings.`);
    });
  }
  return (
    <Panel title="Who can sign in" note={`Admins can change rules, people and uploads. Viewers can see everything but not change it. ${PASSWORD_RULE}`} flush>
      <ul className="list">
        {users.map((u) => (
          <li key={u.id} className="list-row static wrap">
            <span className="grow"><b>{u.name}</b><span className="sub mono">{u.email}</span></span>
            <Pill tone={u.role === 'admin' ? 'accent' : 'mute'}>{u.role === 'admin' ? 'Admin' : 'Viewer'}</Pill>
            {u.id !== ref.user?.id && (
              <>
                <button className="btn sm" onClick={() => { setResetFor(resetFor === u.id ? null : u.id); setNewPw(''); setRemoveFor(null); }}>Set password</button>
                {removeFor === u.id
                  ? <button className="btn sm bad" onClick={() => run(async () => { await api.removeUser(u.id); setRemoveFor(null); toast(`Removed ${u.name}`); await refresh(); })}>Confirm remove</button>
                  : <button className="btn sm ghost" onClick={() => { setRemoveFor(u.id); setResetFor(null); }}>Remove</button>}
              </>
            )}
            {resetFor === u.id && (
              <form className="inline-form" onSubmit={(e) => reset(e, u)}>
                <label htmlFor={`reset-${u.id}`} className="sr">New password for {u.name}</label>
                <input id={`reset-${u.id}`} type="password" autoComplete="new-password" placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} />
                <button className="btn sm pri" type="submit">Save password</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <form className="add-row" onSubmit={add}>
        <input id="u-name" type="text" aria-label="Name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input id="u-email" type="email" aria-label="Email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input id="u-pass" type="password" aria-label="Starting password" placeholder="Starting password (8+ with a number)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} autoComplete="new-password" />
        <select id="u-role" aria-label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="viewer">Viewer</option><option value="admin">Admin</option>
        </select>
        <button className="btn sm" type="submit">Add account</button>
      </form>
      {error && <p className="error inset" role="alert">{error}</p>}
    </Panel>
  );
}
