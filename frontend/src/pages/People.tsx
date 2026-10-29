import { useState } from 'react';
import { useApp } from '../store';
import { PageHead, Panel, Pill } from '../components/ui';
import { fmtShort, hhmm, hm, pct } from '../lib/format';
import { needsAttention, totals } from '../lib/stats';

export function People() {
  const { data, ref, office, open } = useApp();
  const [q, setQ] = useState('');
  const list = ref.employees.filter((e) => !q || `${e.name} ${e.department} ${e.id}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHead title="People" sub="The employee list the tool works from. Joining and leaving dates stop new joiners and leavers showing up as absent." />
      <div className="filters">
        <input id="ppl-q" type="search" placeholder="Find a person or department" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a person or department" />
        <span className="muted small">{list.length} people</span>
      </div>
      <Panel flush>
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Code</th><th>Name</th><th>Office</th><th>Department</th><th>Shift</th><th>Joined</th><th>Status</th><th className="num">Present rate</th><th className="num">Hours</th><th className="num">Need attention</th></tr>
            </thead>
            <tbody>
              {list.map((e) => {
                const days = data.records[e.id] ? Object.values(data.records[e.id]) : [];
                const t = totals(days);
                const o = office(e.officeId);
                const shift = ref.settings.shifts[o.id];
                const n = data.issues.filter((x) => x.employeeId === e.id && needsAttention(x)).length;
                return (
                  <tr key={e.id} className="click" onClick={() => open({ kind: 'person', employeeId: e.id })} tabIndex={0} onKeyDown={(ev) => ev.key === 'Enter' && open({ kind: 'person', employeeId: e.id })}>
                    <td className="mono small">{e.id}</td>
                    <td className="nowrap"><b>{e.name}</b><span className="sub mono">{e.email}</span></td>
                    <td>{o.name}</td>
                    <td>{e.department}</td>
                    <td className="mono small nowrap">{hm(shift.start)}–{hm(shift.end)} {o.tzLabel}</td>
                    <td className="nowrap">{fmtShort(e.joinDate)} {e.joinDate.slice(0, 4)}</td>
                    <td>{e.exitDate ? <Pill tone="mute">Left {fmtShort(e.exitDate)}</Pill> : e.joinDate.slice(0, 7) === data.month ? <Pill tone="accent">New joiner</Pill> : <Pill tone="ok">Active</Pill>}</td>
                    <td className="num">{days.length ? pct(t.rate) : '—'}</td>
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
