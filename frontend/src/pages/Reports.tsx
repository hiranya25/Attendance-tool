import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../store';
import { BarChart } from '../components/BarChart';
import { Empty, PageHead, Panel, Pill, Stat } from '../components/ui';
import { fmtDay, fmtMonth, fmtMonthShort, fmtWhen, pct, plural } from '../lib/format';
import { isUnexplained, needsAttention, totals } from '../lib/stats';
import { download } from '../lib/download';
import { issueRows, masterRows } from '../lib/reports';
import type { Issue, MonthData } from '../types';

interface Pattern { id: string; lates: number; unexplained: number; punches: number; lastMonth: string }

function patterns(issues: Issue[]) {
  const by: Record<string, { lates: number; unexplained: number; punches: number }> = {};
  for (const x of issues) {
    if (x.state === 'explained' || x.state === 'system' || x.state === 'fixed') continue;
    const p = (by[x.employeeId] ??= { lates: 0, unexplained: 0, punches: 0 });
    if (x.type === 'Late arrival') p.lates++;
    if (isUnexplained(x)) p.unexplained++;
    if (x.type === 'Missing punch-in' || x.type === 'Missing punch-out' || x.type === 'Missing record') p.punches++;
  }
  return by;
}
const isPattern = (p: { lates: number; unexplained: number; punches: number }) => p.lates >= 3 || p.unexplained >= 2 || p.punches >= 2;

export function Reports() {
  const { data, ref, trend, emp, office, toast, open } = useApp();
  const [prev, setPrev] = useState<MonthData | null>(null);
  const i = ref.months.indexOf(data.month);
  useEffect(() => {
    let live = true;
    if (i > 0) void api.getMonth(ref.months[i - 1]).then((d) => live && setPrev(d));
    else setPrev(null);
    return () => { live = false; };
  }, [data.month, i, ref.months]);

  const upTo = trend.filter((t) => t.month <= data.month);
  const cur = upTo[upTo.length - 1];
  const last = upTo[upTo.length - 2];
  const delta = (a: number, b?: number, unit = '') => (b == null ? 'No earlier month' : `${a - b > 0 ? '+' : ''}${unit === '%' ? (a - b).toFixed(1) : a - b}${unit} vs ${fmtMonthShort(prevMonth(data.month))}`);

  const now = patterns(data.issues);
  const before = prev ? patterns(prev.issues) : {};
  const rows: Pattern[] = Object.entries(now).filter(([, p]) => isPattern(p)).map(([id, p]) => ({
    id, ...p, lastMonth: before[id] && isPattern(before[id]) ? 'Yes' : 'No',
  })).sort((a, b) => b.unexplained - a.unexplained || b.lates - a.lates);

  const depts = [...new Set(Object.keys(data.records).map((id) => emp(id).department))].sort();
  const attention = data.issues.filter(needsAttention);

  const summary = [
    `${fmtMonth(data.month)}: present rate ${pct(cur?.presentRate ?? 0)} across ${plural(Object.keys(data.records).length, 'person', 'people')} in ${new Set(Object.keys(data.records).map((id) => emp(id).officeId)).size} locations.`,
    `${plural(data.issues.length, 'item')} found. The tool handled ${data.issues.length - attention.length} by itself (emails, late data, likely system issues). ${attention.length} still need attention.`,
    `${plural(data.emails.filter((m) => m.outcome === 'applied').length, 'email')} applied automatically, ${data.emails.filter((m) => m.outcome === 'unclear').length} kept as communicated but unclear.`,
    rows.length ? `${plural(rows.length, 'person', 'people')} show a repeat pattern this month${rows.some((r) => r.lastMonth === 'Yes') ? `, ${rows.filter((r) => r.lastMonth === 'Yes').length} of them also last month` : ''}.` : 'No repeat patterns this month.',
    ...data.sources.filter((s) => !s.ok && s.state !== 'off').map((s) => `${s.name}: ${s.note}`),
  ];

  const recipients = ref.settings.reportRecipients.join(', ');

  return (
    <>
      <PageHead
        title="Monthly report"
        sub={data.close.closed
          ? `Closed automatically ${fmtWhen(data.close.closesAt)}${data.close.reportsSentTo.length ? ` and emailed to ${data.close.reportsSentTo.join(', ')}` : ''}.`
          : `Builds itself as the month goes. Closes automatically ${fmtDay(data.close.closesAt)}${recipients ? ` and is emailed to ${recipients}` : ''}.`}
        actions={
          <>
            <button className="btn sm pri" onClick={() => { download(api.exportUrl(data.month, 'all'), `attendance-${data.month}.csv`, () => masterRows(data, emp, office)); toast('Download started'); }}>Download full workbook</button>
            <button className="btn sm" onClick={() => { download(api.exportUrl(data.month, 'master'), `attendance-${data.month}.csv`, () => masterRows(data, emp, office)); toast('Download started'); }}>Master file</button>
            <button className="btn sm" onClick={() => { download(api.exportUrl(data.month, 'issues'), `issues-${data.month}.csv`, () => issueRows(data, emp, office)); toast('Download started'); }}>Issues report</button>
          </>
        }
      />
      {!recipients && <p className="note">No one is set to receive the monthly package yet. Add email addresses on the Rules page under “Month close and reports”.</p>}
      <SavedReports />
      <div className="stats">
        <Stat label="Present rate" value={pct(cur?.presentRate ?? 0)} sub={delta(cur?.presentRate ?? 0, last?.presentRate, '%')} />
        <Stat label="Items found" value={cur?.issues ?? 0} sub={delta(cur?.issues ?? 0, last?.issues)} />
        <Stat label="Unexplained absences" value={cur?.unexplained ?? 0} sub={delta(cur?.unexplained ?? 0, last?.unexplained)} />
        <Stat label="Late arrivals" value={cur?.lates ?? 0} sub={delta(cur?.lates ?? 0, last?.lates)} />
      </div>

      <Panel title="Summary for management" note="Written from the numbers on this page. This text goes into the emailed package.">
        <ul className="summary">{summary.map((s) => <li key={s}>{s}</li>)}</ul>
      </Panel>

      <div className="two">
        <Panel title="Items found per month" note="Likely system issues left out.">
          <BarChart label="Items found per month" points={upTo.map((t) => ({ key: t.month, label: fmtMonthShort(t.month), value: t.issues, partial: t.month === ref.months[ref.months.length - 1] && !data.close.closed }))} />
        </Panel>
        <Panel title="Unexplained absences per month">
          <BarChart label="Unexplained absences per month" points={upTo.map((t) => ({ key: t.month, label: fmtMonthShort(t.month), value: t.unexplained, partial: t.month === ref.months[ref.months.length - 1] && !data.close.closed }))} />
        </Panel>
      </div>

      <Panel title="Repeat patterns" note="3 or more late arrivals, 2 or more unexplained absences, or 2 or more missing punches in the month. Explained and system items are not counted." flush>
        {rows.length ? (
          <div className="scroll">
            <table>
              <thead><tr><th>Person</th><th className="num">Late arrivals</th><th className="num">Unexplained absences</th><th className="num">Missing punches</th><th>Also last month</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="click" onClick={() => open({ kind: 'person', employeeId: r.id })}>
                    <td><b>{emp(r.id).name}</b> <span className="muted small">{office(emp(r.id).officeId).name}</span></td>
                    <td className={`num${r.lates >= 3 ? ' hot' : ''}`}>{r.lates}</td>
                    <td className={`num${r.unexplained >= 2 ? ' hot' : ''}`}>{r.unexplained}</td>
                    <td className={`num${r.punches >= 2 ? ' hot' : ''}`}>{r.punches}</td>
                    <td>{r.lastMonth === 'Yes' ? <Pill tone="warn">Yes</Pill> : <span className="muted">No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No repeat patterns this month.</Empty>}
      </Panel>

      <Panel title="By department" flush>
        <div className="scroll">
          <table>
            <thead><tr><th>Department</th><th className="num">People</th><th className="num">Present rate</th><th className="num">Leave days</th><th className="num">Items found</th><th className="num">Need attention</th></tr></thead>
            <tbody>
              {depts.map((d) => {
                const ids = Object.keys(data.records).filter((id) => emp(id).department === d);
                const t = totals(ids.flatMap((id) => Object.values(data.records[id])));
                const xs = data.issues.filter((x) => emp(x.employeeId).department === d);
                return (
                  <tr key={d}>
                    <td><b>{d}</b></td>
                    <td className="num">{ids.length}</td>
                    <td className="num">{pct(t.rate)}</td>
                    <td className="num">{t.leave}</td>
                    <td className="num">{xs.length}</td>
                    <td className="num">{xs.filter(needsAttention).length}</td>
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

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
}

/** Every package the tool has built for this month, kept on the server. */
function SavedReports() {
  const { data, ref, reload, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const reports = data.close.reports ?? [];
  async function buildNow() {
    setBusy(true);
    try {
      const r = await api.buildPackage(data.month);
      await reload();
      toast(`Version ${r.version} built${ref.settings.reportRecipients.length ? ' and emailed' : ''}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title="Saved monthly packages"
      note="Each package is an Excel workbook: summary, master sheet, daily detail, issues, HR emails and change log."
      actions={ref.user?.role === 'admin' && data.hasData !== false && <button className="btn sm" onClick={buildNow} disabled={busy}>{busy ? 'Building…' : 'Build and email now'}</button>}
      flush
    >
      {reports.length ? (
        <ul className="list">
          {reports.map((r) => (
            <li key={r.id} className="list-row static">
              <span className="grow"><b>Version {r.version}</b> <span className="muted small">{fmtWhen(r.createdAt)}</span><span className="sub">{r.note}{r.sentTo.length ? `. Sent to ${r.sentTo.join(', ')}` : '. Not emailed (no recipients set)'}</span></span>
              <button className="btn sm" onClick={() => download(api.reportUrl(r.id), '', () => [])}>Download</button>
            </li>
          ))}
        </ul>
      ) : <Empty>{data.close.closed ? 'No package saved.' : `No package yet. The first one is built when the month closes on ${fmtDay(data.close.closesAt)}.`}</Empty>}
    </Panel>
  );
}
