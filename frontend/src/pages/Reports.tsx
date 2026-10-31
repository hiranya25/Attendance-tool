import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../store';
import { PartialNote } from './Overview';
import { Empty, PageHead, Panel, Pill, Stat } from '../components/ui';
import { fmtDay, fmtMonth, fmtMonthShort, fmtWhen, hhmm, hm, pct, plural } from '../lib/format';
import { isUnexplained, needsAttention, totals } from '../lib/stats';
import { download } from '../lib/download';
import { issueRows, masterRows } from '../lib/reports';
import type { Issue, MonthData } from '../types';
import { COMPARE, monthFigures, personFigures, type MonthFigures } from '../../../shared/figures';

interface Pattern { id: string; lates: number; unexplained: number; punches: number; lastMonth: string }

function patterns(issues: Issue[]) {
  const by: Record<string, { lates: number; unexplained: number; punches: number }> = {};
  for (const x of issues) {
    if (x.state === 'explained' || x.state === 'system' || x.state === 'fixed' || x.state === 'allowed') continue;
    const p = (by[x.employeeId] ??= { lates: 0, unexplained: 0, punches: 0 });
    if (x.type === 'Late arrival') p.lates++;
    if (isUnexplained(x)) p.unexplained++;
    if (x.type === 'Missing punch-in' || x.type === 'Missing punch-out' || x.type === 'Missing record') p.punches++;
  }
  return by;
}
const isPattern = (p: { lates: number; unexplained: number; punches: number }) => p.lates >= 1 || p.unexplained >= 2 || p.punches >= 2;

export function Reports() {
  const { data, ref, emp, office, toast, open } = useApp();
  const [prev, setPrev] = useState<MonthData | null>(null);
  const prevKey = prevMonth(data.month);
  useEffect(() => {
    let live = true;
    setPrev(null);
    api.getMonth(prevKey).then((d) => live && setPrev(d.hasData === false ? null : d)).catch(() => live && setPrev(null));
    return () => { live = false; };
  }, [prevKey]);

  // Everything on this page is the selected month only. The previous month appears only where it is labelled as a comparison.
  const f = monthFigures(data);
  const pf = prev ? monthFigures(prev) : null;
  const delta = (key: keyof MonthFigures, unit = '') => {
    if (!pf) return `No data for ${fmtMonthShort(prevKey)}`;
    const d = f[key] - pf[key];
    return `${d > 0 ? '+' : ''}${unit === '%' ? d.toFixed(1) : d}${unit} vs ${fmtMonthShort(prevKey)}`;
  };

  const now = patterns(data.issues);
  const before = prev ? patterns(prev.issues) : {};
  const rows: Pattern[] = Object.entries(now).filter(([, p]) => isPattern(p)).map(([id, p]) => ({
    id, ...p, lastMonth: before[id] && isPattern(before[id]) ? 'Yes' : 'No',
  })).sort((a, b) => b.unexplained - a.unexplained || b.lates - a.lates);

  const depts = [...new Set(Object.keys(data.records).map((id) => emp(id).department))].sort();
  const attention = data.issues.filter(needsAttention);
  const byType = [...data.issues.filter((x) => x.state !== 'system').reduce((m, x) => m.set(x.type, (m.get(x.type) ?? 0) + 1), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
  const officeIds = [...new Set(Object.keys(data.records).map((id) => emp(id).officeId))];
  const byOffice = officeIds.map((o) => {
    const ids = Object.keys(data.records).filter((id) => emp(id).officeId === o);
    return { name: office(o)?.name ?? o, rate: totals(ids.flatMap((id) => Object.values(data.records[id]))).rate, people: ids.length };
  }).sort((a, b) => b.rate - a.rate);
  const people = Object.keys(data.records).map((id) => ({ id, ...personFigures(data, id) })).sort((a, b) => emp(a.id).name.localeCompare(emp(b.id).name));

  const summary = [
    ...(data.hasData === false ? [`No attendance file for ${fmtMonth(data.month)} yet. HR emails are kept and applied once the file is uploaded.`] : []),
    `${fmtMonth(data.month)}: present rate ${pct(f.presentRate)} across ${plural(f.people, 'person', 'people')} in ${officeIds.length} locations${pf ? ` (${fmtMonthShort(prevKey)}: ${pct(pf.presentRate)})` : ''}.`,
    `${plural(f.leaveDays, 'leave day')}, ${plural(f.halfDays, 'half day')}, ${plural(f.unexplained, 'unexplained absence')}.`,
    `${plural(f.lateMarks, 'late mark')} (${f.latesBeyond} beyond the monthly allowance) and ${plural(f.earlyDepartures, 'early departure')}.`,
    `${plural(f.emailsRead, 'HR email')} read; ${f.emailsApplied} applied automatically, ${data.emails.filter((m) => m.outcome === 'unclear').length} kept as communicated but unclear.`,
    `${plural(data.issues.length, 'item')} found. The tool handled ${data.issues.length - attention.length} by itself (emails, later data, likely system issues). ${attention.length} still need attention.`,
    rows.length ? `${plural(rows.length, 'person', 'people')} show a repeat pattern this month${rows.some((r) => r.lastMonth === 'Yes') ? `, ${rows.filter((r) => r.lastMonth === 'Yes').length} of them also in ${fmtMonthShort(prevKey)}` : ''}.` : 'No repeat patterns this month.',
    ...data.sources.filter((s) => !s.ok && s.state !== 'off').map((s) => `${s.name}: ${s.note}`),
  ];

  const recipients = ref.settings.reportRecipients.join(', ');

  return (
    <>
      <PageHead
        title={`Monthly report: ${fmtMonth(data.month)}`}
        sub={data.close.closed
          ? `Closed automatically ${fmtWhen(data.close.closesAt)}${data.close.reportsSentTo.length ? ` and emailed to ${data.close.reportsSentTo.join(', ')}` : ''}.`
          : `Builds itself as the month goes. Closes automatically ${fmtDay(data.close.closesAt)}${recipients ? ` and is emailed to ${recipients}` : ''}.`}
        actions={
          <>
            <button className="btn sm pri" onClick={() => { const u = api.pdfUrl(data.month); if (u) { download(u, '', () => []); toast('Download started'); } else toast('The PDF report is made on the real server.'); }}>PDF report</button>
            <button className="btn sm" onClick={() => { download(api.exportUrl(data.month, 'all'), `attendance-${data.month}.csv`, () => masterRows(data, emp, office)); toast('Download started'); }}>Full workbook</button>
            <button className="btn sm" onClick={() => { download(api.exportUrl(data.month, 'master'), `attendance-${data.month}.csv`, () => masterRows(data, emp, office)); toast('Download started'); }}>Master file</button>
            <button className="btn sm" onClick={() => { download(api.exportUrl(data.month, 'issues'), `issues-${data.month}.csv`, () => issueRows(data, emp, office)); toast('Download started'); }}>Issues report</button>
          </>
        }
      />
      {data.partial && !data.close.closed && <PartialNote />}
      {!recipients && <p className="note">No one is set to receive the monthly report yet. Add email addresses on the Rules page under “Month close and reports”.</p>}
      <SavedReports />
      <div className="stats">
        <Stat label="Present rate" value={pct(f.presentRate)} sub={delta('presentRate', '%')} />
        <Stat label="Leave days" value={f.leaveDays} sub={delta('leaveDays')} />
        <Stat label="Unexplained absences" value={f.unexplained} sub={delta('unexplained')} />
        <Stat label="Late marks" value={f.lateMarks} sub={delta('lateMarks')} />
      </div>

      <Panel title="Summary for management" note="Written from this month's numbers. The same text opens the emailed PDF report.">
        <ul className="summary">{summary.map((s) => <li key={s}>{s}</li>)}</ul>
      </Panel>

      <Panel title={`${fmtMonth(data.month)} compared with ${fmtMonth(prevKey)}`} note={pf ? 'Green is better than the previous month, red is worse.' : `There is no attendance data for ${fmtMonth(prevKey)}, so there is nothing to compare with.`} flush>
        <div className="scroll">
          <table>
            <thead><tr><th>Figure</th><th className="num">{fmtMonthShort(data.month)}</th><th className="num">{fmtMonthShort(prevKey)}</th><th className="num">Change</th></tr></thead>
            <tbody>
              {COMPARE.map((c) => {
                const a = f[c.key];
                const b = pf?.[c.key];
                const d = b == null ? null : a - b;
                const tone = d == null || d === 0 || c.good === 'none' ? '' : (d > 0) === (c.good === 'up') ? ' good' : ' hot';
                const show = (v: number) => (c.unit === '%' ? pct(v) : c.unit === 'h' ? (v ? hhmm(v) : '—') : String(v));
                return (
                  <tr key={c.key}>
                    <td>{c.label}</td>
                    <td className="num">{show(a)}</td>
                    <td className="num">{b == null ? '—' : show(b)}</td>
                    <td className={`num${tone}`}>{d == null ? '—' : `${d > 0 ? '+' : ''}${c.unit === '%' ? d.toFixed(1) : c.unit === 'h' ? (d < 0 ? '-' : '') + hhmm(Math.abs(d)) : d}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="two">
        <Panel title="Items found this month, by type" note="Likely system issues left out.">
          {byType.length ? <HBars rows={byType.map(([k, v]) => ({ label: k, value: v }))} /> : <Empty>Nothing found this month.</Empty>}
        </Panel>
        <Panel title="Present rate by office">
          {byOffice.length ? <HBars rows={byOffice.map((o) => ({ label: `${o.name} (${o.people})`, value: o.rate }))} max={100} format={(v) => pct(v)} /> : <Empty>No attendance data this month.</Empty>}
        </Panel>
      </div>

      <Panel title="Each person this month" note="When people come in, how long they work, leave taken, and whether absences and lates were communicated by email. Click a person for their days." flush>
        {people.length ? (
          <div className="scroll">
            <table>
              <thead><tr><th>Person</th><th className="num">Present rate</th><th className="num">Usual time in</th><th className="num">Average hours</th><th className="num">Leave days</th><th className="num">Late marks</th><th className="num">Early departures</th><th className="num">Communicated</th><th className="num">Unexplained</th></tr></thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} className="click" onClick={() => open({ kind: 'person', employeeId: p.id })} tabIndex={0} onKeyDown={(ev) => ev.key === 'Enter' && open({ kind: 'person', employeeId: p.id })}>
                    <td><b>{emp(p.id).name}</b><span className="sub">{office(emp(p.id).officeId)?.name}</span></td>
                    <td className="num">{pct(p.presentRate)}</td>
                    <td className="num mono">{p.avgLogin == null ? '—' : hm(p.avgLogin)}</td>
                    <td className="num mono">{p.avgMinutes ? hhmm(p.avgMinutes) : '—'}</td>
                    <td className="num">{p.leaveDays}</td>
                    <td className="num">{p.lates}</td>
                    <td className="num">{p.early}</td>
                    <td className="num">{p.communicated}</td>
                    <td className={`num${p.unexplained ? ' hot' : ''}`}>{p.unexplained}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No attendance data this month.</Empty>}
      </Panel>

      <Panel title="Repeat patterns" note="Any late mark beyond the office's monthly allowance, 2 or more unexplained absences, or 2 or more missing punches in the month. Explained and system items are not counted." flush>
        {rows.length ? (
          <div className="scroll">
            <table>
              <thead><tr><th>Person</th><th className="num">Late marks beyond allowance</th><th className="num">Unexplained absences</th><th className="num">Missing punches</th><th>Also in {fmtMonthShort(prevKey)}</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="click" onClick={() => open({ kind: 'person', employeeId: r.id })}>
                    <td><b>{emp(r.id).name}</b> <span className="muted small">{office(emp(r.id).officeId).name}</span></td>
                    <td className={`num${r.lates >= 1 ? ' hot' : ''}`}>{r.lates}</td>
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
                    <td><b>{d || 'No department'}</b></td>
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

/** Horizontal bars with the label on the left: reads well with long names, on any screen width. */
function HBars({ rows, max, format = String }: { rows: { label: string; value: number }[]; max?: number; format?: (v: number) => string }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="hb-label">{r.label}</span>
          <span className="hb-track"><i style={{ width: `${Math.max(0, Math.min(100, (r.value / top) * 100))}%` }} /></span>
          <span className="hb-value">{format(r.value)}</span>
        </li>
      ))}
    </ul>
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
  const openFile = (url: string | null) => (url ? download(url, '', () => []) : toast('Saved reports download on the real server.'));
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
      title="Saved monthly reports"
      note="Each version has the PDF report (summary, charts, comparison with the previous month, each person) and the attendance Excel workbook."
      actions={ref.user?.role === 'admin' && data.hasData !== false && <button className="btn sm" onClick={buildNow} disabled={busy}>{busy ? 'Building…' : data.partial ? 'Build and email now (month so far)' : 'Build and email now'}</button>}
      flush
    >
      {reports.length ? (
        <ul className="list">
          {reports.map((r) => (
            <li key={r.id} className="list-row static">
              <span className="grow"><b>Version {r.version}</b> <span className="muted small">{fmtWhen(r.createdAt)}</span><span className="sub">{r.note}{r.sentTo.length ? `. Sent to ${r.sentTo.join(', ')}` : '. Not emailed (no recipients set)'}</span></span>
              <span className="row-gap">
                {r.hasPdf && <button className="btn sm" onClick={() => openFile(api.reportUrl(r.id, 'pdf'))}>PDF</button>}
                <button className="btn sm" onClick={() => openFile(api.reportUrl(r.id))}>Excel</button>
              </span>
            </li>
          ))}
        </ul>
      ) : <Empty>{data.close.closed ? 'No report saved.' : `No report yet. The first one is made when the month closes on ${fmtDay(data.close.closesAt)}.`}</Empty>}
    </Panel>
  );
}
