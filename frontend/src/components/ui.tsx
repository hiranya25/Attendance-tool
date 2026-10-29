import { useEffect, useRef, type ReactNode } from 'react';
import type { DayCode, IssueState, Severity } from '../types';

export const STATE_LABEL: Record<IssueState, string> = {
  open: 'Open',
  reminded: 'Reminder sent',
  unclear: 'Communicated, unclear',
  explained: 'Explained by email',
  fixed: 'Fixed by late data',
  system: 'Likely system issue',
};
const STATE_TONE: Record<IssueState, string> = {
  open: 'bad', reminded: 'warn', unclear: 'warn', explained: 'ok', fixed: 'ok', system: 'info',
};

export function StatePill({ state }: { state: IssueState }) {
  return <span className={`pill t-${STATE_TONE[state]}`}>{STATE_LABEL[state]}</span>;
}

export function Pill({ tone = 'mute', children }: { tone?: 'ok' | 'warn' | 'bad' | 'info' | 'mute' | 'accent'; children: ReactNode }) {
  return <span className={`pill t-${tone}`}>{children}</span>;
}

const SEV_LABEL: Record<Severity, string> = { high: 'High', medium: 'Medium', low: 'Low' };
export function Sev({ s }: { s: Severity }) {
  return <span className={`sev sev-${s}`} title={`${SEV_LABEL[s]} priority`} aria-label={`${SEV_LABEL[s]} priority`} />;
}

export const CODE_LABEL: Record<DayCode, string> = {
  P: 'Present', HD: 'Half day', A: 'Absent', LV: 'Leave', HL: 'Holiday', WO: 'Weekly off', NR: 'No record', NE: 'Not employed', F: 'Upcoming',
};

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'bad' | 'warn' | 'ok' }) {
  return (
    <div className={`stat${tone ? ' stat-' + tone : ''}`}>
      <span className="stat-l">{label}</span>
      <span className="stat-v">{value}</span>
      {sub && <span className="stat-s">{sub}</span>}
    </div>
  );
}

export function Panel({ title, note, actions, children, flush }: { title?: ReactNode; note?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className={`panel${flush ? ' flush' : ''}`}>
      {(title || actions) && (
        <header className="panel-h">
          <div>
            {title && <h2>{title}</h2>}
            {note && <p className="muted">{note}</p>}
          </div>
          {actions && <div className="row-gap">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-h">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {actions && <div className="row-gap">{actions}</div>}
    </div>
  );
}

export function Drawer({ title, sub, onClose, children }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <>
      <div className="veil" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" tabIndex={-1} ref={ref}>
        <div className="drawer-h">
          <div>
            <h2>{title}</h2>
            {sub && <p className="muted">{sub}</p>}
          </div>
          <button className="btn icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </aside>
    </>
  );
}

export function Timeline({ items }: { items: { at: string; text: ReactNode }[] }) {
  return (
    <ol className="tl">
      {items.map((t, i) => (
        <li key={i}>
          <time className="mono">{t.at}</time>
          <span>{t.text}</span>
        </li>
      ))}
    </ol>
  );
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
