import { useState } from 'react';
import { useApp } from '../store';
import { PageHead, Panel, Pill } from '../components/ui';
import { fmtShort, hhmm, hm, pct } from '../lib/format';
import { needsAttention, totals } from '../lib/stats';
import type { Employee } from '../types';

export function People() {
  const { data, ref, office, open } = useApp();
  const [q, setQ] = useState('');
  const [off, setOff] = useState('');
  const [mgr, setMgr] = useState('');
  const [status, setStatus] = useState('');
  const [shiftCode, setShiftCode] = useState('');
  const [cal, setCal] = useState('');
  const [attention, setAttention] = useState(false);
  const notTracked = ref.employees.filter((e) => e.tracked === false).length;
  const statusOf = (e: Employee) => (e.tracked === false ? 'not-tracked' : e.exitDate ? 'left' : e.joinDate && e.joinDate.slice(0, 7) === data.month ? 'new' : 'active');
  const attentionOf = (id: string) => data.issues.filter((x) => x.employeeId === id && needsAttention(x)).length;
  const list = ref.employees.filter((e) => (status === 'not-tracked' || status === 'all' || e.tracked !== false)
    && (!q || `${e.name} ${e.department} ${e.id} ${e.aliases} ${e.manager ?? ''} ${e.role ?? ''} ${e.email}`.toLowerCase().includes(q.toLowerCase()))
    && (!off || e.officeId === off)
    && (!mgr || (e.manager ?? '') === mgr)
    && (!status || status === 'all' || statusOf(e) === status)
    && (!shiftCode || e.shiftCode === shiftCode)
    && (!cal || e.calendarId === cal)
    && (!attention || attentionOf(e.id) > 0));
  const missingEmail = ref.employees.filter((e) => !e.email && !e.exitDate && e.tracked !== false).length;
  const calName = Object.fromEntries(ref.calendars.map((c) => [c.id, c.name]));
  const shiftOf = Object.fromEntries(ref.shifts.map((s) => [s.code, s]));
  const managers = [...new Set(ref.employees.map((e) => e.manager ?? '').filter(Boolean))].sort();
  const shiftCodes = [...new Set(ref.employees.map((e) => e.shiftCode).filter(Boolean))].sort();
  const filtered = Boolean(q || off || mgr || status || shiftCode || cal || attention);

  return (
    <>
      <PageHead title="People" sub="The employee list the tool works from. Upload the team list on Attendance files to fill in managers, roles and emails; people marked NA are not tracked. Click a person to edit their details." />
      {missingEmail > 0 && ref.settings.remindersOn && (
        <p className="note">{missingEmail} {missingEmail === 1 ? 'person has' : 'people have'} no email address yet, so reminders cannot reach them. Add it by clicking the person.</p>
      )}
      <div className="filters">
        <input id="ppl-q" type="search" placeholder="Find a person, role or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a person, role or email" />
        <select id="ppl-off" value={off} onChange={(e) => setOff(e.target.value)} aria-label="Office">
          <option value="">All offices</option>
          {ref.offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {managers.length > 0 && (
          <select id="ppl-mgr" value={mgr} onChange={(e) => setMgr(e.target.value)} aria-label="Manager">
            <option value="">Any manager</option>
            {managers.map((m) => <option key={m}>{m}</option>)}
          </select>
        )}
        <select id="ppl-status" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Tracked people</option>
          <option value="active">Active</option>
          <option value="new">New joiners this month</option>
          <option value="left">Left</option>
          {notTracked > 0 && <option value="not-tracked">Not tracked (NA on the team list)</option>}
          <option value="all">Everyone</option>
        </select>
        <select id="ppl-shift" value={shiftCode} onChange={(e) => setShiftCode(e.target.value)} aria-label="Shift">
          <option value="">Any shift</option>
          {shiftCodes.map((c) => <option key={c} value={c}>{c}{shiftOf[c] ? ` ${shiftOf[c].name}` : ''}</option>)}
        </select>
        <select id="ppl-cal" value={cal} onChange={(e) => setCal(e.target.value)} aria-label="Holiday calendar">
          <option value="">Any holiday calendar</option>
          {ref.calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="switch small" htmlFor="ppl-att"><input id="ppl-att" type="checkbox" checked={attention} onChange={(e) => setAttention(e.target.checked)} /> Needs attention only</label>
        {filtered && <button className="btn sm ghost" type="button" onClick={() => { setQ(''); setOff(''); setMgr(''); setStatus(''); setShiftCode(''); setCal(''); setAttention(false); }}>Clear filters</button>}
        <span className="muted small">{list.length} people</span>
      </div>
      <Panel flush>
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Code</th><th>Name</th><th>Office</th><th>Manager</th><th>Shift</th><th>Holidays</th><th>Status</th><th className="num">Present rate</th><th className="num">Hours</th><th className="num">Need attention</th></tr>
            </thead>
            <tbody>
              {list.map((e) => {
                const days = data.records[e.id] ? Object.values(data.records[e.id]) : [];
                const t = totals(days);
                const shift = shiftOf[e.shiftCode];
                const n = attentionOf(e.id);
                return (
                  <tr key={e.id} className="click" onClick={() => open({ kind: 'person', employeeId: e.id })} tabIndex={0} onKeyDown={(ev) => ev.key === 'Enter' && open({ kind: 'person', employeeId: e.id })}>
                    <td className="mono small">{e.id}</td>
                    <td className="nowrap"><b>{e.name}</b><span className="sub mono">{e.email || 'No email yet'}</span></td>
                    <td>{office(e.officeId)?.name ?? e.officeId}<span className="sub">{e.role || e.department}</span></td>
                    <td className="small">{e.manager || <span className="muted">—</span>}</td>
                    <td className="mono small nowrap">{shift ? `${e.shiftCode} ${hm(shift.start)}–${hm(shift.end)}` : e.shiftCode || '—'}</td>
                    <td className="small">{calName[e.calendarId] ?? '—'}</td>
                    <td>{e.tracked === false ? <Pill tone="mute">Not tracked</Pill> : e.exitDate ? <Pill tone="mute">Left {fmtShort(e.exitDate)}</Pill> : e.joinDate && e.joinDate.slice(0, 7) === data.month ? <Pill tone="accent">New joiner</Pill> : <Pill tone="ok">Active</Pill>}</td>
                    <td className="num">{t.workdays ? pct(t.rate) : '—'}</td>
                    <td className="num mono">{days.length ? hhmm(t.minutes) : '—'}</td>
                    <td className="num">{n || <span className="muted">0</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
