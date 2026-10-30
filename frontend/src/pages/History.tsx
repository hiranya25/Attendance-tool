import { useEffect, useState } from 'react';
import { api, usingSampleData } from '../api';
import { useApp } from '../store';
import { BarChart } from '../components/BarChart';
import { Empty, PageHead, Panel, Pill } from '../components/ui';
import { fmtDay, fmtMonth, fmtMonthShort, fmtWhen, pct } from '../lib/format';
import { download } from '../lib/download';
import type { MonthSummary } from '../types';

/** Every month the tool has data for: key figures, the files used, and every saved monthly report. */
export function History() {
  const { setMonth, go, toast } = useApp();
  const [rows, setRows] = useState<MonthSummary[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.getHistory().then(setRows).catch((e) => setError((e as Error).message)); }, []);

  const openMonth = (m: string, view: string) => {
    setMonth(m);
    go(view);
  };
  const chrono = rows ? [...rows].reverse() : [];

  return (
    <>
      <PageHead
        title="Past months"
        sub="Every month with attendance data, newest first. Open a month to see its attendance, issues and report, or download the saved reports."
      />
      {error && <p className="error" role="alert">{error}</p>}
      {rows === null ? <Empty>Loading…</Empty> : rows.length === 0 ? (
        <Panel><Empty>No months yet. Upload an attendance file on Attendance files and it appears here. Older months can be uploaded too.</Empty></Panel>
      ) : (
        <>
          {chrono.length > 1 && (
            <div className="two">
              <Panel title="Present rate by month">
                <BarChart label="Present rate by month" max={100} format={(v) => `${Math.round(v)}%`} points={chrono.map((r) => ({ key: r.month, label: fmtMonthShort(r.month), value: r.presentRate, partial: r.partial }))} />
              </Panel>
              <Panel title="Unexplained absences by month">
                <BarChart label="Unexplained absences by month" points={chrono.map((r) => ({ key: r.month, label: fmtMonthShort(r.month), value: r.unexplained, partial: r.partial }))} />
              </Panel>
            </div>
          )}
          <Panel flush>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Month</th><th>Status</th><th className="num">People</th><th className="num">Present rate</th><th className="num">Leave days</th>
                    <th className="num">Need attention</th><th className="num">Unexplained</th><th className="num" title="Late marks beyond the monthly allowance">Extra lates</th><th>Saved reports</th><th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.month}>
                      <td className="nowrap">
                        <b>{fmtMonth(r.month)}</b>
                        <span className="sub">{r.files.map((f) => (f.scope === 'punch' ? 'Punch export' : 'Mumbai sheet')).join(' + ')}</span>
                      </td>
                      <td className="nowrap">
                        {r.closed ? <Pill tone="ok">Closed</Pill> : r.partial ? <Pill tone="warn">In progress</Pill> : <Pill tone="info">Complete, not closed</Pill>}
                        <span className="sub">Data up to {fmtDay(r.dataThrough)}</span>
                      </td>
                      <td className="num">{r.people}</td>
                      <td className="num">{pct(r.presentRate)}</td>
                      <td className="num">{r.leaveDays}</td>
                      <td className="num">{r.needAttention || <span className="muted">0</span>}</td>
                      <td className={`num${r.unexplained ? ' hot' : ''}`}>{r.unexplained}</td>
                      <td className={`num${r.latesBeyond ? ' hot' : ''}`}>{r.latesBeyond}</td>
                      <td>
                        {r.reports.length ? (
                          <div className="row-gap">
                            {r.reports.map((rp) => (
                              <button key={rp.id} className="btn sm" title={`${rp.note}, ${fmtWhen(rp.createdAt)}`}
                                onClick={() => (usingSampleData ? toast('Saved reports download on the real server.') : download(api.reportUrl(rp.id), '', () => []))}>
                                Version {rp.version}
                              </button>
                            ))}
                          </div>
                        ) : <span className="muted small">Not closed yet</span>}
                      </td>
                      <td className="nowrap">
                        <button className="btn sm" onClick={() => openMonth(r.month, 'overview')}>Open</button>{' '}
                        <button className="btn sm" onClick={() => openMonth(r.month, 'reports')}>Report</button>{' '}
                        <button className="btn sm" onClick={() => download(api.exportUrl(r.month, 'all'), `attendance-${r.month}.csv`, () => [])}>Excel</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <p className="muted small">To add an older month, upload its attendance file on Attendance files. It appears here, and the month closes with its own report.</p>
        </>
      )}
    </>
  );
}
