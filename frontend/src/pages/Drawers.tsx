import { useApp, type DrawerTarget } from '../store';
import { CODE_LABEL, Drawer, Empty, KV, Pill, Sev, StatePill, Timeline } from '../components/ui';
import { EmailCard } from './Emails';
import { dur, fmtDay, fmtMonth, fmtShort, fmtWhen, hhmm, hm, monthDates, pct } from '../lib/format';
import { needsAttention, totals } from '../lib/stats';
import type { Issue, IssueState } from '../types';

const NEXT: Record<IssueState, string> = {
  open: 'Stays in the issues report. If more data or an email arrives, the tool updates it by itself.',
  reminded: 'Waiting for the employee to reply or for the missing data to arrive. Stays in the report until then.',
  unclear: 'The person got in touch, but the email could not be matched with confidence. Shown as communicated in the report, not as unexplained.',
  explained: 'Nothing more to do. Shown as explained in the report.',
  fixed: 'Nothing more to do. The corrected data is in the master file.',
  system: 'Not counted against the employee. HR was alerted about the likely device or sync problem.',
};

export function DrawerHost({ target, onClose }: { target: DrawerTarget; onClose: () => void }) {
  if (target.kind === 'issue') return <IssueDrawer id={target.id} onClose={onClose} />;
  if (target.kind === 'day') return <DayDrawer employeeId={target.employeeId} date={target.date} onClose={onClose} />;
  if (target.kind === 'person') return <PersonDrawer employeeId={target.employeeId} onClose={onClose} />;
  return <EmailDrawer id={target.id} onClose={onClose} />;
}

function IssueDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, emp, office, open } = useApp();
  const x = data.issues.find((i) => i.id === id);
  if (!x) return <Drawer title="Issue not found" onClose={onClose}><Empty>This issue is not in the selected month.</Empty></Drawer>;
  const e = emp(x.employeeId);
  const o = office(e.officeId);
  const rec = data.records[x.employeeId][x.date];
  const mail = x.emailId ? data.emails.find((m) => m.id === x.emailId) : undefined;
  return (
    <Drawer title={x.type} sub={<>{e.name} · {fmtDay(x.date)} · {o.name}</>} onClose={onClose}>
      <div className="row-gap"><StatePill state={x.state} /><span className="muted small"><Sev s={x.severity} />{x.severity} priority</span></div>
      <p>{x.detail}</p>
      <KV items={[
        ['Scheduled', rec.scheduledStart != null ? `${hm(rec.scheduledStart)}–${hm(rec.scheduledEnd)} ${o.tzLabel}` : '—'],
        ['Login', <span className="mono">{hm(rec.login)}</span>],
        ['Logout', <span className="mono">{hm(rec.logout)}</span>],
        ['Hours worked', dur(rec.minutesWorked)],
      ]} />
      <section>
        <h3>What happens next</h3>
        <p className="muted">{NEXT[x.state]}</p>
      </section>
      {mail && <section><h3>Linked email</h3><EmailCard m={mail} /></section>}
      <section>
        <h3>History</h3>
        <Timeline items={x.timeline.map((t) => ({ at: fmtWhen(t.at), text: t.text }))} />
      </section>
      <div className="row-gap">
        <button className="btn sm" onClick={() => open({ kind: 'day', employeeId: x.employeeId, date: x.date })}>Open the day</button>
        <button className="btn sm" onClick={() => open({ kind: 'person', employeeId: x.employeeId })}>{e.name.split(' ')[0]}'s month</button>
      </div>
    </Drawer>
  );
}

function DayDrawer({ employeeId, date, onClose }: { employeeId: string; date: string; onClose: () => void }) {
  const { data, emp, office, open } = useApp();
  const e = emp(employeeId);
  const o = office(e.officeId);
  const rec = data.records[employeeId]?.[date];
  if (!rec) return <Drawer title="No data" onClose={onClose}><Empty>No record for this day.</Empty></Drawer>;
  const issues = data.issues.filter((x) => x.employeeId === employeeId && x.date === date);
  const changes = data.changes.filter((c) => c.employeeId === employeeId && (c.date === date || (!c.date && rec.code === 'NE')));
  const status = rec.leaveType ?? CODE_LABEL[rec.code];
  return (
    <Drawer title={e.name} sub={<>{fmtDay(date)} · {o.name} ({o.tzLabel})</>} onClose={onClose}>
      <KV items={[
        ['Status', <b>{status}{rec.note ? ` · ${rec.note}` : ''}</b>],
        ['Scheduled', rec.scheduledStart != null ? `${hm(rec.scheduledStart)}–${hm(rec.scheduledEnd)}` : '—'],
        ['Login', <span className="mono">{hm(rec.login)}</span>],
        ['Logout', <span className="mono">{hm(rec.logout)}</span>],
        ['Hours worked', dur(rec.minutesWorked)],
        ['Punches', rec.punches ?? '—'],
      ]} />
      {rec.original && (
        <p className="note">
          The source system sent <b>{CODE_LABEL[rec.original.code]}</b>
          {rec.original.login !== undefined || rec.original.logout !== undefined ? <> with login {hm(rec.original.login)} and logout {hm(rec.original.logout)}</> : null}.
          The tool changed it. The original is kept.
        </p>
      )}
      <section>
        <h3>Issues on this day</h3>
        {issues.length ? (
          <ul className="list">
            {issues.map((x: Issue) => (
              <li key={x.id}>
                <button className="list-row" onClick={() => open({ kind: 'issue', id: x.id })}>
                  <Sev s={x.severity} /><span className="grow">{x.type}</span><StatePill state={x.state} />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="muted">None.</p>}
      </section>
      <section>
        <h3>Changes</h3>
        {changes.length ? (
          <Timeline items={changes.map((c) => ({ at: fmtWhen(c.at), text: <><s>{c.from}</s> → <b>{c.to}</b>. {c.reason}</> }))} />
        ) : <p className="muted">No changes. This is what the source system sent.</p>}
      </section>
    </Drawer>
  );
}

function PersonDrawer({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const { data, emp, office, open, ref } = useApp();
  const e = emp(employeeId);
  const o = office(e.officeId);
  const days = data.records[employeeId];
  const issues = data.issues.filter((x) => x.employeeId === employeeId).sort((a, b) => b.date.localeCompare(a.date));
  const shift = ref.settings.shifts[o.id];
  if (!days) {
    return (
      <Drawer title={e.name} sub={`${o.name} · ${e.department}`} onClose={onClose}>
        <Empty>{e.name} was not employed in {fmtMonth(data.month)}.</Empty>
      </Drawer>
    );
  }
  const t = totals(Object.values(days));
  return (
    <Drawer title={e.name} sub={<>{o.name} · {e.department} · <span className="mono">{e.id}</span></>} onClose={onClose}>
      <KV items={[
        ['Email', <span className="mono small">{e.email}</span>],
        ['Shift', `${hm(shift.start)}–${hm(shift.end)} ${o.tzLabel}`],
        ['Joined', `${fmtShort(e.joinDate)} ${e.joinDate.slice(0, 4)}`],
        ['Left', e.exitDate ? fmtShort(e.exitDate) : '—'],
      ]} />
      <section>
        <h3>{fmtMonth(data.month)}</h3>
        <div className="strip" aria-label="Days of the month">
          {monthDates(data.month).map((d) => (
            <button key={d} className={`cell c-${days[d].code}`} disabled={days[d].code === 'F'} title={`${fmtDay(d)}: ${days[d].leaveType ?? CODE_LABEL[days[d].code]}`} onClick={() => open({ kind: 'day', employeeId, date: d })}>
              {Number(d.slice(8))}
            </button>
          ))}
        </div>
        <KV items={[
          ['Present', t.present], ['Absent', t.absent], ['Leave', t.leave], ['Present rate', pct(t.rate)], ['Hours', hhmm(t.minutes)], ['Need attention', issues.filter(needsAttention).length],
        ]} />
      </section>
      <section>
        <h3>Issues this month</h3>
        {issues.length ? (
          <ul className="list">
            {issues.map((x) => (
              <li key={x.id}>
                <button className="list-row" onClick={() => open({ kind: 'issue', id: x.id })}>
                  <Sev s={x.severity} />
                  <span className="grow">{x.type}<span className="sub">{fmtDay(x.date)}</span></span>
                  <StatePill state={x.state} />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="muted">None this month.</p>}
      </section>
      {e.exitDate && <Pill tone="mute">Left on {fmtShort(e.exitDate)}. Later days are not counted.</Pill>}
    </Drawer>
  );
}

function EmailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useApp();
  const m = data.emails.find((x) => x.id === id);
  return (
    <Drawer title={m ? m.subject : 'Email not found'} sub={m ? `${m.from}` : undefined} onClose={onClose}>
      {m ? <EmailCard m={m} /> : <Empty>This email is not in the selected month.</Empty>}
    </Drawer>
  );
}
