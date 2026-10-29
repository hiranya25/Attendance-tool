import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useApp, type DrawerTarget } from '../store';
import { CODE_LABEL, Drawer, Empty, KV, Pill, Sev, StatePill, Timeline } from '../components/ui';
import { EmailCard } from './Emails';
import { dur, fmtDay, fmtMonth, fmtShort, fmtWhen, hhmm, hm, monthDates, pct } from '../lib/format';
import { needsAttention, totals } from '../lib/stats';
import type { Issue, IssueState } from '../types';

const NEXT: Record<IssueState, string> = {
  open: 'Stays in the issues report. If more data or an email arrives, the tool updates it by itself.',
  reminded: 'Waiting for the employee to reply or for the missing data to arrive. Stays in the report until then.',
  unclear: 'The person got in touch, but the email could not be matched with confidence. Shown as communicated in the report, not as unexplained.',
  explained: 'Nothing more to do. Shown as explained in the report.',
  fixed: 'Nothing more to do. The corrected data is in the master file.',
  system: 'Not counted against the employee. HR was alerted about the likely device or sync problem.',
};

export function DrawerHost({ target, onClose }: { target: DrawerTarget; onClose: () => void }) {
  if (target.kind === 'issue') return <IssueDrawer id={target.id} onClose={onClose} />;
  if (target.kind === 'day') return <DayDrawer employeeId={target.employeeId} date={target.date} onClose={onClose} />;
  if (target.kind === 'person') return <PersonDrawer employeeId={target.employeeId} onClose={onClose} />;
  return <EmailDrawer id={target.id} onClose={onClose} />;
}

function IssueDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, emp, office, open } = useApp();
  const x = data.issues.find((i) => i.id === id);
  if (!x) return <Drawer title="Issue not found" onClose={onClose}><Empty>This issue is not in the selected month.</Empty></Drawer>;
  const e = emp(x.employeeId);
  const o = office(e.officeId);
  const rec = data.records[x.employeeId][x.date];
  const mail = x.emailId ? data.emails.find((m) => m.id === x.emailId) : undefined;
  return (
    <Drawer title={x.type} sub={<>{e.name} · {fmtDay(x.date)} · {o.name}</>} onClose={onClose}>
      <div className="row-gap"><StatePill state={x.state} /><span className="muted small"><Sev s={x.severity} />{x.severity} priority</span></div>
      <p>{x.detail}</p>
      <KV items={[
        ['Scheduled', rec.scheduledStart != null ? `${hm(rec.scheduledStart)}–${hm(rec.scheduledEnd)} ${o.tzLabel}` : '—'],
        ['Login', <span className="mono">{hm(rec.login)}</span>],
        ['Logout', <span className="mono">{hm(rec.logout)}</span>],
        ['Hours worked', dur(rec.minutesWorked)],
      ]} />
      <section>
        <h3>What happens next</h3>
        <p className="muted">{NEXT[x.state]}</p>
      </section>
      {mail && <section><h3>Linked email</h3><EmailCard m={mail} /></section>}
      <section>
        <h3>History</h3>
        <Timeline items={x.timeline.map((t) => ({ at: fmtWhen(t.at), text: t.text }))} />
      </section>
      <div className="row-gap">
        <button className="btn sm" onClick={() => open({ kind: 'day', employeeId: x.employeeId, date: x.date })}>Open the day</button>
        <button className="btn sm" onClick={() => open({ kind: 'person', employeeId: x.employeeId })}>{e.name.split(' ')[0]}'s month</button>
      </div>
    </Drawer>
  );
}

function DayDrawer({ employeeId, date, onClose }: { employeeId: string; date: string; onClose: () => void }) {
  const { data, emp, office, open } = useApp();
  const e = emp(employeeId);
  const o = office(e.officeId);
  const rec = data.records[employeeId]?.[date];
  if (!rec) return <Drawer title="No data" onClose={onClose}><Empty>No record for this day.</Empty></Drawer>;
  const issues = data.issues.filter((x) => x.employeeId === employeeId && x.date === date);
  const changes = data.changes.filter((c) => c.employeeId === employeeId && (c.date === date || (!c.date && rec.code === 'NE')) || (!c.employeeId && c.date === date && rec.original));
  const status = rec.leaveType ?? CODE_LABEL[rec.code];
  return (
    <Drawer title={e.name} sub={<>{fmtDay(date)} · {o.name} ({o.tzLabel})</>} onClose={onClose}>
      <KV items={[
        ['Status', <b>{status}{rec.note ? ` · ${rec.note}` : ''}</b>],
        ['Scheduled', rec.scheduledStart != null ? `${hm(rec.scheduledStart)}–${hm(rec.scheduledEnd)}` : '—'],
        ['Login', <span className="mono">{hm(rec.login)}</span>],
        ['Logout', <span className="mono">{hm(rec.logout)}</span>],
        ['Hours worked', dur(rec.minutesWorked)],
        ['Shift', rec.shift ?? '—'],
      ]} />
      {rec.device && (
        <p className="muted small">
          Punch system said: <b>{rec.device.status}</b>{rec.device.remark ? ` (${rec.device.remark})` : ''}, {hhmm(rec.device.workMinutes)} worked{rec.device.lessMinutes ? `, ${hhmm(rec.device.lessMinutes)} short` : ''}.
        </p>
      )}
      {rec.original && (
        <p className="note">
          The source system sent <b>{CODE_LABEL[rec.original.code]}</b>
          {rec.original.login !== undefined || rec.original.logout !== undefined ? <> with login {hm(rec.original.login)} and logout {hm(rec.original.logout)}</> : null}.
          The tool changed it. The original is kept.
        </p>
      )}
      <section>
        <h3>Issues on this day</h3>
        {issues.length ? (
          <ul className="list">
            {issues.map((x: Issue) => (
              <li key={x.id}>
                <button className="list-row" onClick={() => open({ kind: 'issue', id: x.id })}>
                  <Sev s={x.severity} /><span className="grow">{x.type}</span><StatePill state={x.state} />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="muted">None.</p>}
      </section>
      <section>
        <h3>Changes</h3>
        {changes.length ? (
          <Timeline items={changes.map((c) => ({ at: fmtWhen(c.at), text: <><s>{c.from}</s> → <b>{c.to}</b>. {c.reason}</> }))} />
        ) : <p className="muted">No changes. This is what the source system sent.</p>}
      </section>
    </Drawer>
  );
}

function PersonDrawer({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const { data, emp, office, open, ref } = useApp();
  const e = emp(employeeId);
  const o = office(e.officeId);
  const days = data.records[employeeId];
  const issues = data.issues.filter((x) => x.employeeId === employeeId).sort((a, b) => b.date.localeCompare(a.date));
  const shift = ref.shifts.find((s) => s.code === e.shiftCode);
  const cal = ref.calendars.find((c) => c.id === e.calendarId);
  const details = (
    <>
      <KV items={[
        ['Email', <span className="mono small">{e.email || 'Not set'}</span>],
        ['Shift', shift ? `${shift.code} ${hm(shift.start)}–${hm(shift.end)} ${o?.tzLabel ?? ''}` : e.shiftCode || '—'],
        ['Holidays', cal?.name ?? '—'],
        ['Joined', e.joinDate ? `${fmtShort(e.joinDate)} ${e.joinDate.slice(0, 4)}` : 'Not set'],
        ['Left', e.exitDate ? `${fmtShort(e.exitDate)} ${e.exitDate.slice(0, 4)}` : '—'],
      ]} />
      {ref.user?.role === 'admin' && <PersonEditor employeeId={employeeId} />}
    </>
  );
  if (!days) {
    return (
      <Drawer title={e.name} sub={`${o?.name ?? ''} · ${e.department}`} onClose={onClose}>
        {details}
        <Empty>No attendance for {e.name} in {fmtMonth(data.month)}.</Empty>
      </Drawer>
    );
  }
  const t = totals(Object.values(days));
  return (
    <Drawer title={e.name} sub={<>{o?.name} · {e.department} · <span className="mono">{e.id}</span></>} onClose={onClose}>
      {details}
      <section>
        <h3>{fmtMonth(data.month)}</h3>
        <div className="strip" aria-label="Days of the month">
          {monthDates(data.month).map((d) => (
            <button key={d} className={`cell c-${days[d].code}`} disabled={days[d].code === 'F'} title={`${fmtDay(d)}: ${days[d].leaveType ?? CODE_LABEL[days[d].code]}`} onClick={() => open({ kind: 'day', employeeId, date: d })}>
              {Number(d.slice(8))}
            </button>
          ))}
        </div>
        <KV items={[
          ['Present', t.present], ['Absent', t.absent], ['Leave', t.leave], ['Present rate', pct(t.rate)], ['Hours', hhmm(t.minutes)], ['Need attention', issues.filter(needsAttention).length],
        ]} />
      </section>
      <section>
        <h3>Issues this month</h3>
        {issues.length ? (
          <ul className="list">
            {issues.map((x) => (
              <li key={x.id}>
                <button className="list-row" onClick={() => open({ kind: 'issue', id: x.id })}>
                  <Sev s={x.severity} />
                  <span className="grow">{x.type}<span className="sub">{fmtDay(x.date)}</span></span>
                  <StatePill state={x.state} />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="muted">None this month.</p>}
      </section>
      {e.exitDate && <Pill tone="mute">Left on {fmtShort(e.exitDate)}. Later days are not counted.</Pill>}
    </Drawer>
  );
}

function EmailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useApp();
  const m = data.emails.find((x) => x.id === id);
  return (
    <Drawer title={m ? m.subject : 'Email not found'} sub={m ? `${m.from}` : undefined} onClose={onClose}>
      {m ? <EmailCard m={m} /> : <Empty>This email is not in the selected month.</Empty>}
    </Drawer>
  );
}

/** Edit a person's details. Every change is written to the change log. */
function PersonEditor({ employeeId }: { employeeId: string }) {
  const { emp, ref, reload, toast } = useApp();
  const e = emp(employeeId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: e.email, officeId: e.officeId, shiftCode: e.shiftCode, calendarId: e.calendarId, joinDate: e.joinDate ?? '', exitDate: e.exitDate ?? '', aliases: e.aliases });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (ev: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: ev.target.value }));
  if (!open) return <button className="btn sm" onClick={() => setOpen(true)}>Edit details</button>;
  async function save(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.saveEmployee(employeeId, { ...form, joinDate: form.joinDate || null, exitDate: form.exitDate || null });
      await reload();
      toast('Saved. Attendance was checked again.');
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form edit" onSubmit={save}>
      <label className="field" htmlFor="pe-email"><span>Email (for reminders)</span><input id="pe-email" type="email" value={form.email} onChange={set('email')} /></label>
      <label className="field" htmlFor="pe-aliases"><span>Other names used in emails</span><input id="pe-aliases" type="text" value={form.aliases} onChange={set('aliases')} placeholder="For example Jolly" /></label>
      <div className="two-col">
        <label className="field" htmlFor="pe-office"><span>Office</span>
          <select id="pe-office" value={form.officeId} onChange={set('officeId')}>{ref.offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        </label>
        <label className="field" htmlFor="pe-shift"><span>Usual shift</span>
          <select id="pe-shift" value={form.shiftCode} onChange={set('shiftCode')}>{ref.shifts.map((s) => <option key={s.code} value={s.code}>{s.code} {hm(s.start)}–{hm(s.end)}</option>)}</select>
        </label>
      </div>
      <label className="field" htmlFor="pe-cal"><span>Holiday calendar</span>
        <select id="pe-cal" value={form.calendarId} onChange={set('calendarId')}>{ref.calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </label>
      <div className="two-col">
        <label className="field" htmlFor="pe-join"><span>Joining date</span><input id="pe-join" type="date" value={form.joinDate} onChange={set('joinDate')} /></label>
        <label className="field" htmlFor="pe-exit"><span>Leaving date</span><input id="pe-exit" type="date" value={form.exitDate} onChange={set('exitDate')} /></label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row-gap">
        <button className="btn sm pri" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button className="btn sm" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
