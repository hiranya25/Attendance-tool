import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { CODE_LABEL, PageHead, Panel } from '../components/ui';
import { dayOfWeek, dowLetter, fmtDay, fmtMonth, hhmm, monthDates } from '../lib/format';
import { needsAttention, totals } from '../lib/stats';
import { download } from '../lib/download';
import { api } from '../api';
import { dailyRows, masterRows } from '../lib/reports';
import type { DayCode, DayRecord } from '../types';

const SHORT: Record<DayCode, string> = { P: 'P', HD: '½', A: 'A', LV: 'L', HL: 'H', WO: '', NR: '?', NE: '', F: '' };
const LEGEND: DayCode[] = ['P', 'HD', 'A', 'LV', 'HL', 'WO', 'NR', 'NE'];

export function Attendance() {
  const { data, ref, emp, office, open, toast } = useApp();
  const [off, setOff] = useState('all');
  const [q, setQ] = useState('');
  const dates = monthDates(data.month);
  const flagged = useMemo(() => new Set(data.issues.filter(needsAttention).map((x) => `${x.employeeId}|${x.date}`)), [data]);

  const ids = Object.keys(data.records).filter((id) => {
    const e = emp(id);
    return (off === 'all' || e.officeId === off) && (!q || e.name.toLowerCase().includes(q.toLowerCase()));
  });

  const title = (d: DayRecord, name: string) => `${name}, ${fmtDay(d.date)}: ${d.leaveType ?? CODE_LABEL[d.code]}${d.note ? ' (' + d.note + ')' : ''}${d.original ? '. Changed by the tool' : ''}`;

  return (
    <>
      <PageHead
        title="Master attendance"
        sub={`${fmtMonth(data.month)}, every office in one sheet. Click any day to see times and history.`}
        actions={
          <>
            <button className="btn sm" onClick={() => { download(api.exportUrl(data.month, 'master'), `attendance-${data.month}.csv`, () => masterRows(data, emp, office)); toast('Download started'); }}>Download master file</button>
            <button className="btn sm" onClick={() => { download(api.exportUrl(data.month, 'all'), `attendance-daily-${data.month}.csv`, () => dailyRows(data, emp, office)); toast('Download started'); }}>Download full workbook</button>
          </>
        }
      />
      <div className="filters">
        <div className="chips" role="group" aria-label="Office">
          {[{ id: 'all', name: 'All offices' }, ...ref.offices.filter((o) => ref.employees.some((e) => e.officeId === o.id))].map((o) => (
            <button key={o.id} className={`chip${off === o.id ? ' on' : ''}`} onClick={() => setOff(o.id)} aria-pressed={off === o.id}>{o.name}</button>
          ))}
        </div>
        <input id="att-search" type="search" placeholder="Find a person" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a person" />
      </div>
      <Panel flush>
        <div className="scroll">
          <table className="grid-cal">
            <thead>
              <tr>
                <th className="nm">Person</th>
                {dates.map((d) => {
                  const w = dayOfWeek(d);
                  return <th key={d} className={ref.settings.weeklyOff.includes(w) ? 'we' : ''}>{Number(d.slice(8))}<small>{dowLetter(d)}</small></th>;
                })}
                <th className="t">Pres</th><th className="t">Abs</th><th className="t">Leave</th><th className="t">Hours</th>
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => {
                const e = emp(id);
                const days = dates.map((d) => data.records[id][d]);
                const t = totals(days);
                return (
                  <tr key={id}>
                    <td className="nm">
                      <button className="link" onClick={() => open({ kind: 'person', employeeId: id })}>{e.name}</button>
                      <small>{office(e.officeId).name} · {e.department}</small>
                    </td>
                    {days.map((d) => (
                      <td key={d.date}>
                        <button
                          className={`cell c-${d.code}`}
                          disabled={d.code === 'F'}
                          onClick={() => open({ kind: 'day', employeeId: id, date: d.date })}
                          title={title(d, e.name)}
                          aria-label={title(d, e.name)}
                        >
                          {SHORT[d.code]}
                          {flagged.has(`${id}|${d.date}`) && <span className="flag" />}
                          {d.original && <span className="fixed" />}
                        </button>
                      </td>
                    ))}
                    <td className="t">{t.present}</td>
                    <td className="t">{t.absent}</td>
                    <td className="t">{t.leave}</td>
                    <td className="t">{hhmm(t.minutes)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="legend">
        {LEGEND.map((c) => <span key={c}><span className={`cell c-${c}`}>{SHORT[c]}</span>{CODE_LABEL[c]}</span>)}
        <span><span className="cell c-P">P<span className="flag" /></span>Needs attention</span>
        <span><span className="cell c-LV">L<span className="fixed" /></span>Changed by the tool</span>
      </div>
    </>
  );
}
