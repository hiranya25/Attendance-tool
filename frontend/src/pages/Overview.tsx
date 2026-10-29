import { useApp } from '../store';
import { Empty, PageHead, Panel, Pill, Sev, Stat, StatePill } from '../components/ui';
import { fmtDay, fmtMonth, fmtShort, fmtWhen, pct, plural } from '../lib/format';
import { isUnexplained, needsAttention, totals } from '../lib/stats';
import type { Issue } from '../types';

const SEV_N = { high: 3, medium: 2, low: 1 };

export function Overview() {
  const { data, ref, emp, open, go } = useApp();
  const attention = data.issues.filter(needsAttention);
  const unexplained = attention.filter(isUnexplained);
  const applied = data.emails.filter((m) => m.outcome === 'applied').length;
  const unclear = data.emails.filter((m) => m.outcome === 'unclear').length;
  const handled = data.issues.filter((x) => !needsAttention(x)).length + data.changes.filter((c) => c.source === 'HR email' || c.source === 'Late data').length;
  const allDays = Object.values(data.records).flatMap((r) => Object.values(r));
  const t = totals(allDays);
  const top = [...attention].sort((a, b) => SEV_N[b.severity] - SEV_N[a.severity] || b.date.localeCompare(a.date)).slice(0, 7);
  const reminders = data.notifications.filter((n) => n.audience === 'Employee').length;

  const feed = [
    ...data.changes.filter((c) => c.source !== 'Settings').map((c) => ({ at: c.at, text: `${c.employeeId ? emp(c.employeeId).name : c.subject}: ${c.from} → ${c.to}`, tag: c.source })),
    ...data.notifications.filter((n) => n.audience !== 'HR' || n.subject.startsWith('Likely')).map((n) => ({ at: n.at, text: n.subject, tag: n.audience === 'Employee' ? 'Reminder' : n.audience === 'HR' ? 'Alert to HR' : 'Report sent' })),
  ].sort((a, b) => b.at.localeCompare(a.at)).filter((f, i, all) => all.findIndex((g) => g.at === f.at && g.text === f.text) === i).slice(0, 8);

  const steps = [
    { done: true, now: !data.close.closed, title: 'Collecting daily', text: `${data.sources.length} sources, ${Object.keys(data.records).length} people` },
    { done: true, now: false, title: 'Checking and fixing', text: `${plural(data.changes.filter((c) => c.source !== 'Settings').length, 'automatic change')} so far` },
    { done: data.close.closed, now: false, title: 'Month closes', text: data.close.closed ? `Closed ${fmtWhen(data.close.closesAt)}` : `Automatically on ${fmtDay(data.close.closesAt)}, 06:00` },
    { done: data.close.closed, now: false, title: 'Reports emailed', text: data.close.closed ? `Sent to ${data.close.reportsSentTo.length} people` : `To ${ref.settings.reportRecipients.join(', ')}` },
  ];

  return (
    <>
      <PageHead
        title={fmtMonth(data.month)}
        sub={data.close.closed ? 'This month is closed. Reports were sent automatically.' : `Everything below is updated by the tool each morning. Data up to ${fmtDay(data.dataThrough)}.`}
      />
      <div className="stats">
        <Stat label="Needs attention" value={attention.length} sub={`${plural(handled, 'other item')} handled by the tool`} tone={attention.length ? 'bad' : 'ok'} />
        <Stat label="Unexplained absences" value={unexplained.length} sub="No punches, no leave, no email" tone={unexplained.length ? 'warn' : undefined} />
        <Stat label="Emails applied" value={applied} sub={unclear ? `${unclear} kept as communicated, unclear` : 'All matched with confidence'} />
        <Stat label="Present rate" value={pct(t.rate)} sub="Leave, holidays and weekly offs left out" />
      </div>

      <Panel title="Month progress" note="The tool moves through these steps on its own.">
        <ol className="steps">
          {steps.map((s) => (
            <li key={s.title} className={s.now ? 'now' : s.done ? 'done' : 'todo'}>
              <b>{s.title}</b>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="two">
        <Panel title="Needs attention" note="Highest priority first. Click a row for the full story." actions={<button className="btn sm" onClick={() => go('issues')}>All issues</button>} flush>
          {top.length ? (
            <ul className="list">
              {top.map((x: Issue) => (
                <li key={x.id}>
                  <button className="list-row" onClick={() => open({ kind: 'issue', id: x.id })}>
                    <Sev s={x.severity} />
                    <span className="grow">
                      <b>{emp(x.employeeId).name}</b> <span className="muted">{fmtDay(x.date)}</span>
                      <span className="sub">{x.type}</span>
                    </span>
                    <StatePill state={x.state} />
                  </button>
                </li>
              ))}
            </ul>
          ) : <Empty>Nothing needs attention this month.</Empty>}
        </Panel>

        <Panel title="What the tool did" note={`${plural(reminders, 'reminder')} sent to employees this month`} actions={<button className="btn sm" onClick={() => go('changes')}>Change log</button>} flush>
          <ul className="feed">
            {feed.map((f, i) => (
              <li key={i}>
                <time className="mono">{fmtShort(f.at)} {f.at.slice(11, 16)}</time>
                <span>{f.text}</span>
                <Pill tone={f.tag === 'Reminder' ? 'warn' : f.tag === 'Alert to HR' ? 'info' : f.tag === 'Report sent' ? 'accent' : 'mute'}>{f.tag}</Pill>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="two">
        <Panel title="By office" flush>
          <div className="scroll">
            <table>
              <thead>
                <tr><th>Office</th><th className="num">People</th><th className="num">Present rate</th><th className="num">Attention</th><th className="num">Unexplained</th></tr>
              </thead>
              <tbody>
                {ref.offices.map((o) => {
                  const ids = Object.keys(data.records).filter((id) => emp(id).officeId === o.id);
                  const r = totals(ids.flatMap((id) => Object.values(data.records[id])));
                  const a = attention.filter((x) => emp(x.employeeId).officeId === o.id);
                  return (
                    <tr key={o.id}>
                      <td><b>{o.name}</b> <span className="muted small">{o.tzLabel}</span></td>
                      <td className="num">{ids.length}</td>
                      <td className="num nowrap"><span className="meter"><i style={{ width: `${r.rate}%` }} /></span>{pct(r.rate)}</td>
                      <td className="num">{a.length}</td>
                      <td className="num">{a.filter(isUnexplained).length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Data sources" flush>
          <ul className="list">
            {data.sources.map((s) => (
              <li key={s.name} className="list-row static">
                <span className="grow">
                  <b>{s.name}</b>
                  <span className="sub">{s.note}</span>
                </span>
                <Pill tone={s.ok ? 'ok' : 'warn'}>{s.ok ? 'Receiving' : 'Check device'}</Pill>
              </li>
            ))}
          </ul>
          <p className="panel-foot muted small">Every source is collected automatically at 06:00 IST each day.</p>
        </Panel>
      </div>
    </>
  );
}
