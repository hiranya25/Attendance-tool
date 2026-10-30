import { useState } from 'react';
import { useApp } from '../store';
import { PageHead, Panel, Pill } from '../components/ui';
import { fmtShort, hhmm, hm, pct } from '../lib/format';
import { needsAttention, totals } from '../lib/stats';

export function People() {
  const { data, ref, office, open } = useApp();
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const notTracked = ref.employees.filter((e) => e.tracked === false).length;
  const list = ref.employees.filter((e) => (showAll || e.tracked !== false) && (!q || `${e.name} ${e.department} ${e.id} ${e.aliases} ${e.manager ?? ''} ${e.role ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  const missingEmail = ref.employees.filter((e) => !e.email && !e.exitDate && e.tracked !== false).length;
  const calName = Object.fromEntries(ref.calendars.map((c) => [c.id, c.name]));
  const shiftOf = Object.fromEntries(ref.shifts.map((s) => [s.code, s]));

  return (
    <>
      <PageHead title="People" sub="The employee list the tool works from. Upload the team list on Attendance files to fill in managers, roles and emails; people marked NA are not tracked. Click a person to edit their details." />
      {missingEmail > 0 && (
        <p className="note">{missingEmail} {missingEmail === 1 ? 'person has' : 'people have'} no email address yet, so reminders cannot reach them. Add it by clicking the person.</p>
      )}
      <div className="filters">
        <input id="ppl-q" type="search" placeholder="Find a person or department" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a person or department" />
        <span className="muted small">{list.length} people</span>
        {notTracked > 0 && (
          <label className="switch small" htmlFor="ppl-all"><input id="ppl-all" type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show {notTracked} not tracked (NA on the team list)</label>
        )}
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
                const n = data.issues.filter((x) => x.employeeId === e.id && needsAttention(x)).length;
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
