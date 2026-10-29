import { useState } from 'react';
import { useApp } from '../store';
import { Empty, PageHead, Panel, Pill } from '../components/ui';
import { fmtDay, fmtMonth, fmtWhen } from '../lib/format';
import { downloadCsv } from '../lib/export';
import { changeRows } from '../lib/reports';
import type { ChangeSource } from '../types';

const SOURCES: ChangeSource[] = ['HR email', 'Late data', 'Employee list', 'Holiday calendar', 'Settings'];

export function Changes() {
  const { data, emp, open, toast } = useApp();
  const [src, setSrc] = useState<'' | ChangeSource>('');
  const [q, setQ] = useState('');
  const list = data.changes.filter((c) => (!src || c.source === src) && (!q || (c.employeeId ? emp(c.employeeId).name : c.subject ?? '').toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <PageHead
        title="Change log"
        sub={`Every change made to ${fmtMonth(data.month)}, newest first. The original data is never deleted, so any change can be traced back.`}
        actions={<button className="btn sm" onClick={() => { downloadCsv(`change-log-${data.month}.csv`, changeRows(data, emp)); toast('Change log downloaded'); }}>Download change log</button>}
      />
      <div className="filters">
        <div className="chips" role="group" aria-label="Source">
          <button className={`chip${src === '' ? ' on' : ''}`} onClick={() => setSrc('')}>All {data.changes.length}</button>
          {SOURCES.map((s) => {
            const n = data.changes.filter((c) => c.source === s).length;
            return n ? <button key={s} className={`chip${src === s ? ' on' : ''}`} onClick={() => setSrc(s)}>{s} {n}</button> : null;
          })}
        </div>
        <input id="chg-q" type="search" placeholder="Find a person" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a person" />
      </div>
      <Panel flush>
        {list.length ? (
          <div className="scroll">
            <table>
              <thead>
                <tr><th>When</th><th>Who</th><th>Day</th><th>Change</th><th>Why</th><th>Source</th></tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td className="nowrap mono small">{fmtWhen(c.at)}</td>
                    <td className="nowrap">
                      {c.employeeId ? <button className="link" onClick={() => open({ kind: 'person', employeeId: c.employeeId as string })}>{emp(c.employeeId).name}</button> : <b>{c.subject}</b>}
                    </td>
                    <td className="nowrap">
                      {c.date && c.employeeId ? <button className="link" onClick={() => open({ kind: 'day', employeeId: c.employeeId as string, date: c.date as string })}>{fmtDay(c.date)}</button> : c.date ? fmtDay(c.date) : '—'}
                    </td>
                    <td className="change"><s>{c.from}</s> <span aria-hidden="true">→</span> <b>{c.to}</b></td>
                    <td className="muted wide">
                      {c.reason}
                      {c.emailId && <> <button className="link small" onClick={() => open({ kind: 'email', id: c.emailId as string })}>Read email</button></>}
                    </td>
                    <td><Pill tone={c.source === 'HR email' ? 'accent' : c.source === 'Settings' ? 'info' : 'mute'}>{c.source}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No changes match.</Empty>}
      </Panel>
    </>
  );
}
