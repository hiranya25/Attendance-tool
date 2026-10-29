import { useState } from 'react';
import { useApp } from '../store';
import { Empty, PageHead, Pill } from '../components/ui';
import { fmtMonth, fmtShort, fmtWhen } from '../lib/format';
import type { EmailOutcome, HrEmail } from '../types';

const OUTCOME: Record<EmailOutcome, { label: string; tone: 'ok' | 'warn' | 'mute' }> = {
  applied: { label: 'Applied', tone: 'ok' },
  unclear: { label: 'Communicated, unclear', tone: 'warn' },
  'not-attendance': { label: 'Not about attendance', tone: 'mute' },
};

export function Emails() {
  const { data, ref } = useApp();
  const [f, setF] = useState<'' | EmailOutcome>('');
  const list = data.emails.filter((m) => !f || m.outcome === f);
  const count = (o: EmailOutcome) => data.emails.filter((m) => m.outcome === o).length;

  return (
    <>
      <PageHead
        title="HR emails"
        sub={`Emails to hr@amipi.com in ${fmtMonth(data.month)}. The tool reads each one, finds the person and the day, and updates attendance itself.`}
      />
      <p className="note">
        Emails matched with {ref.settings.autoApplyConfidence}% confidence or more are applied straight away. Below that, the day stays absent and is marked
        “Communicated, unclear”, so you can see the person did get in touch. You can change the {ref.settings.autoApplyConfidence}% on the Rules page.
      </p>
      <div className="chips" role="group" aria-label="Filter emails">
        <button className={`chip${f === '' ? ' on' : ''}`} onClick={() => setF('')}>All {data.emails.length}</button>
        {(Object.keys(OUTCOME) as EmailOutcome[]).map((o) => (
          <button key={o} className={`chip${f === o ? ' on' : ''}`} onClick={() => setF(o)}>{OUTCOME[o].label} {count(o)}</button>
        ))}
      </div>
      {list.length ? list.map((m) => <EmailCard key={m.id} m={m} />) : <Empty>No emails in this group.</Empty>}
    </>
  );
}

export function EmailCard({ m }: { m: HrEmail }) {
  const { emp, office, ref } = useApp();
  const e = m.employeeId ? emp(m.employeeId) : null;
  const low = m.confidence < ref.settings.autoApplyConfidence;
  return (
    <article className="panel mail">
      <div className="mail-body">
        <div className="muted small mono">{m.from} · {fmtWhen(m.receivedAt)}</div>
        <h3>{m.subject}</h3>
        <blockquote>{m.body}</blockquote>
      </div>
      <div className="mail-read">
        <dl className="pairs">
          <div><dt>Understood as</dt><dd>{m.detected}</dd></div>
          <div><dt>Person</dt><dd>{e ? `${e.name} · ${office(e.officeId).name}` : 'Nobody'}</dd></div>
          <div><dt>Days</dt><dd>{m.dates.length ? m.dates.map(fmtShort).join(', ') : '—'}</dd></div>
          {m.outcome !== 'not-attendance' && (
            <div>
              <dt>Match confidence</dt>
              <dd className="conf"><span className={`meter${low ? ' low' : ''}`}><i style={{ width: `${m.confidence}%` }} /></span>{m.confidence}%</dd>
            </div>
          )}
        </dl>
        {m.warning && <p className="note small">{m.warning}</p>}
        <div className="did">
          <Pill tone={OUTCOME[m.outcome].tone}>{OUTCOME[m.outcome].label}</Pill>
          <span>{m.action}</span>
        </div>
      </div>
    </article>
  );
}
