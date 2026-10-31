import { useState } from 'react';
import { useApp } from '../store';
import { Empty, PageHead, Panel, Pill } from '../components/ui';
import { fmtMonth, fmtWhen } from '../lib/format';
import type { Notification } from '../types';

type Aud = Notification['audience'];
const TONE: Record<Aud, 'warn' | 'info' | 'accent'> = { Employee: 'warn', HR: 'info', Management: 'accent' };

export function Reminders() {
  const { data, ref, open } = useApp();
  const [aud, setAud] = useState<'' | Aud>('');
  const list = data.notifications.filter((n) => !aud || n.audience === aud);
  const s = ref.settings;

  return (
    <>
      <PageHead title="Emails sent" sub={`Every email the tool sent, or would have sent, for ${fmtMonth(data.month)}. By default only the month-end report goes out.`} />
      <div className="stats three">
        <div className="rule-card">
          <b>To employees</b>
          <span>{s.remindersOn ? `${s.reminderAfterDays} working day after a missing punch or an unexplained absence, for days in the last ${s.reminderWindowDays} days. Needs the person's email on the People page.` : 'None. Attendance is tracked silently and reported at month end.'}</span>
        </div>
        <div className="rule-card">
          <b>To HR</b>
          <span>{s.hrDigestOn ? `A daily summary at ${s.hrDigestTime} IST to ${s.hrEmail}.` : 'No daily summary.'} {s.remindersOn ? 'Alerts for long absences and likely device problems.' : 'No alerts during the month.'}</span>
        </div>
        <div className="rule-card">
          <b>To management</b>
          <span>{s.reportRecipients.length ? `The PDF report and attendance Excel on day ${s.closeDay} of the next month, to ${s.reportRecipients.join(', ')}.` : 'No recipients set yet. Add them on the Rules page.'}</span>
        </div>
      </div>
      <div className="chips" role="group" aria-label="Recipient">
        <button className={`chip${aud === '' ? ' on' : ''}`} onClick={() => setAud('')}>All {data.notifications.length}</button>
        {(['Employee', 'HR', 'Management'] as Aud[]).map((a) => (
          <button key={a} className={`chip${aud === a ? ' on' : ''}`} onClick={() => setAud(a)}>{a} {data.notifications.filter((n) => n.audience === a).length}</button>
        ))}
      </div>
      <Panel flush>
        {list.length ? (
          <div className="scroll">
            <table>
              <thead><tr><th>Sent</th><th>To</th><th>Message</th><th /></tr></thead>
              <tbody>
                {list.map((n) => (
                  <tr key={n.id}>
                    <td className="nowrap mono small">{fmtWhen(n.at)}</td>
                    <td><Pill tone={TONE[n.audience]}>{n.audience}</Pill><span className="sub mono">{n.to}</span>{n.sent === false && <span className="sub" title={n.error ?? ''}>Not sent: {n.error}</span>}</td>
                    <td className="wide">{n.subject}</td>
                    <td>
                      <div className="row-gap">
                        <button className="btn sm" onClick={() => open({ kind: 'message', id: n.id })}>Preview</button>
                        {n.issueIds.length > 0 && <button className="btn sm" onClick={() => open({ kind: 'issue', id: n.issueIds[0] })}>View issue</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No messages.</Empty>}
      </Panel>
    </>
  );
}
