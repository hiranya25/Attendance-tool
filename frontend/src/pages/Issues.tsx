import { useState } from 'react';
import { useApp } from '../store';
import { Empty, PageHead, Panel, Sev, STATE_LABEL, StatePill } from '../components/ui';
import { fmtDay, fmtMonth } from '../lib/format';
import { ATTENTION } from '../lib/stats';
import { download } from '../lib/download';
import { api } from '../api';
import { issueRows } from '../lib/reports';
import type { IssueState } from '../types';

const SEV_N = { high: 3, medium: 2, low: 1 };
const STATES = Object.keys(STATE_LABEL) as IssueState[];

export function Issues() {
  const { data, ref, emp, office, open, toast } = useApp();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [off, setOff] = useState('');
  const [state, setState] = useState<'attention' | 'all' | IssueState>('attention');
  const [sev, setSev] = useState('');

  const types = [...new Set(data.issues.map((x) => x.type))].sort();
  const list = data.issues
    .filter((x) => {
      const e = emp(x.employeeId);
      return (!q || e.name.toLowerCase().includes(q.toLowerCase()))
        && (!type || x.type === type)
        && (!off || e.officeId === off)
        && (!sev || x.severity === sev)
        && (state === 'all' || (state === 'attention' ? ATTENTION.includes(x.state) : x.state === state));
    })
    .sort((a, b) => SEV_N[b.severity] - SEV_N[a.severity] || b.date.localeCompare(a.date));

  const byState = STATES.map((s) => [s, data.issues.filter((x) => x.state === s).length] as const);

  return (
    <>
      <PageHead
        title="Issues"
        sub={`Everything the daily check found in ${fmtMonth(data.month)}, and what happened to each one. Nothing is labelled an offence.`}
        actions={<button className="btn sm" onClick={() => { download(api.exportUrl(data.month, 'issues'), `issues-${data.month}.csv`, () => issueRows(data, emp, office)); toast('Download started'); }}>Download issues report</button>}
      />
      <div className="state-strip" role="group" aria-label="Filter by status">
        <button className={state === 'attention' ? 'on' : ''} onClick={() => setState('attention')}>
          <b>{data.issues.filter((x) => ATTENTION.includes(x.state)).length}</b>Needs attention
        </button>
        {byState.map(([s, n]) => (
          <button key={s} className={state === s ? 'on' : ''} onClick={() => setState(s)}>
            <b>{n}</b>{STATE_LABEL[s]}
          </button>
        ))}
        <button className={state === 'all' ? 'on' : ''} onClick={() => setState('all')}>
          <b>{data.issues.length}</b>Everything
        </button>
      </div>
      <div className="filters">
        <input id="iss-q" type="search" placeholder="Find a person" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a person" />
        <select id="iss-type" value={type} onChange={(e) => setType(e.target.value)} aria-label="Issue type">
          <option value="">All issue types</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select id="iss-off" value={off} onChange={(e) => setOff(e.target.value)} aria-label="Office">
          <option value="">All offices</option>
          {ref.offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select id="iss-sev" value={sev} onChange={(e) => setSev(e.target.value)} aria-label="Priority">
          <option value="">Any priority</option>
          <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <span className="muted small">{list.length} shown</span>
      </div>
      <Panel flush>
        {list.length ? (
          <div className="scroll">
            <table>
              <thead>
                <tr><th>Person</th><th>Day</th><th>Issue</th><th>What the tool found</th><th>Status</th></tr>
              </thead>
              <tbody>
                {list.map((x) => {
                  const e = emp(x.employeeId);
                  return (
                    <tr key={x.id} className="click" onClick={() => open({ kind: 'issue', id: x.id })} tabIndex={0} onKeyDown={(ev) => ev.key === 'Enter' && open({ kind: 'issue', id: x.id })}>
                      <td className="nowrap"><Sev s={x.severity} /><b>{e.name}</b><span className="sub indent">{office(e.officeId).name}</span></td>
                      <td className="nowrap">{fmtDay(x.date)}</td>
                      <td className="nowrap">{x.type}</td>
                      <td className="muted wide">{x.detail}</td>
                      <td><StatePill state={x.state} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>No issues match these filters.</Empty>}
      </Panel>
    </>
  );
}
