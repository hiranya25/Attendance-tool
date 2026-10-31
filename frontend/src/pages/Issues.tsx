import { Fragment, useState } from 'react';
import { useApp } from '../store';
import { Empty, PageHead, Panel, Sev, STATE_LABEL, StatePill } from '../components/ui';
import { fmtDay, fmtMonth } from '../lib/format';
import { ATTENTION } from '../lib/stats';
import { download } from '../lib/download';
import { api } from '../api';
import { issueRows } from '../lib/reports';
import type { Issue, IssueState } from '../types';

const SEV_N = { high: 3, medium: 2, low: 1 };
const STATES = Object.keys(STATE_LABEL) as IssueState[];
type GroupBy = '' | 'type' | 'person' | 'office';
const GROUPS: [GroupBy, string][] = [['', 'No grouping'], ['type', 'Group by issue type'], ['person', 'Group by person'], ['office', 'Group by office']];

/** "5 late arrival · 2 missing punch-out": what a group is made of. */
function breakdown(items: Issue[], by: (x: Issue) => string) {
  const n = new Map<string, number>();
  for (const x of items) n.set(by(x), (n.get(by(x)) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([k, c]) => `${c} ${k.toLowerCase()}`).join(' · ');
}

export function Issues() {
  const { data, ref, emp, office, open, toast } = useApp();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [off, setOff] = useState('');
  const [state, setState] = useState<'attention' | 'all' | IssueState>('attention');
  const [sev, setSev] = useState('');
  const [mgr, setMgr] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [group, setGroup] = useState<GroupBy>('');
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const types = [...new Set(data.issues.map((x) => x.type))].sort();
  const managers = [...new Set(data.issues.map((x) => emp(x.employeeId)?.manager ?? '').filter(Boolean))].sort();
  const list = data.issues
    .filter((x) => {
      const e = emp(x.employeeId);
      return (!q || e.name.toLowerCase().includes(q.toLowerCase()))
        && (!type || x.type === type)
        && (!off || e.officeId === off)
        && (!sev || x.severity === sev)
        && (!mgr || e.manager === mgr)
        && (!from || x.date >= from)
        && (!to || x.date <= to)
        && (state === 'all' || (state === 'attention' ? ATTENTION.includes(x.state) : x.state === state));
    })
    .sort((a, b) => SEV_N[b.severity] - SEV_N[a.severity] || b.date.localeCompare(a.date));

  const groupKey = (x: Issue) => (group === 'type' ? x.type : group === 'person' ? emp(x.employeeId).name : office(emp(x.employeeId).officeId)?.name ?? '');
  const groups = group
    ? [...list.reduce((m, x) => m.set(groupKey(x), [...(m.get(groupKey(x)) ?? []), x]), new Map<string, Issue[]>()).entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    : [['', list] as [string, Issue[]]];
  const toggle = (k: string) => setClosed((c) => { const n = new Set(c); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const monthStart = `${data.month}-01`;
  const monthEnd = `${data.month}-${String(new Date(Number(data.month.slice(0, 4)), Number(data.month.slice(5, 7)), 0).getDate()).padStart(2, '0')}`;
  const filtered = Boolean(q || type || off || sev || mgr || from || to);

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
        {managers.length > 0 && (
          <select id="iss-mgr" value={mgr} onChange={(e) => setMgr(e.target.value)} aria-label="Manager">
            <option value="">Any manager</option>
            {managers.map((m) => <option key={m}>{m}</option>)}
          </select>
        )}
        <label className="date-range">
          <span className="muted small">From</span>
          <input id="iss-from" type="date" min={monthStart} max={monthEnd} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="date-range">
          <span className="muted small">to</span>
          <input id="iss-to" type="date" min={monthStart} max={monthEnd} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <select id="iss-group" value={group} onChange={(e) => { setGroup(e.target.value as GroupBy); setClosed(new Set()); }} aria-label="Group by">
          {GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {filtered && <button className="btn sm ghost" type="button" onClick={() => { setQ(''); setType(''); setOff(''); setSev(''); setMgr(''); setFrom(''); setTo(''); }}>Clear filters</button>}
        <span className="muted small">{list.length} shown{group ? ` in ${groups.length} groups` : ''}</span>
      </div>
      <Panel flush>
        {list.length ? (
          <div className="scroll">
            <table>
              <thead>
                <tr><th>Person</th><th>Day</th><th>Issue</th><th>What the tool found</th><th>Status</th></tr>
              </thead>
              <tbody>
                {groups.map(([g, items]) => (
                  <Fragment key={g || 'all'}>
                    {group && (
                      <tr className="group click" onClick={() => toggle(g)} tabIndex={0} aria-expanded={!closed.has(g)} onKeyDown={(ev) => ev.key === 'Enter' && toggle(g)}>
                        <td colSpan={5}>
                          <span className="caret" aria-hidden="true">{closed.has(g) ? '▸' : '▾'}</span>
                          <b>{g || 'Unknown'}</b> <span className="count-pill">{items.length}</span>
                          <span className="sub">{breakdown(items, group === 'type' ? (x) => STATE_LABEL[x.state] : (x) => x.type)}</span>
                        </td>
                      </tr>
                    )}
                    {!closed.has(g) && items.map((x) => {
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
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No issues match these filters.</Empty>}
      </Panel>
    </>
  );
}
