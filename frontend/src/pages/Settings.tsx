import { useState, type FormEvent } from 'react';
import { api, usingSampleData } from '../api';
import { useApp } from '../store';
import { PageHead, Panel, Pill } from '../components/ui';
import { PASSWORD_RULE, passwordProblem } from '../lib/password';
import { applyTheme, savedTheme, type Theme } from '../lib/theme';

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/** Your own account: who you are signed in as, the look of the screens, your password, and signing out. */
export function Settings() {
  const { ref, go, signOut } = useApp();
  const user = ref.user;
  const [theme, setTheme] = useState<Theme>(savedTheme);
  const pick = (t: Theme) => { setTheme(t); applyTheme(t); };

  return (
    <>
      <PageHead title="Settings" sub="Your account and how the screens look. Office rules, calendars and who can sign in are on Rules & calendars." />
      <div className="two">
        <Panel title="Your account">
          {user ? (
            <div className="me">
              <span className="avatar lg" aria-hidden="true">{initials(user.name)}</span>
              <div>
                <b>{user.name}</b>
                <span className="sub mono">{user.email}</span>
                <span className="role">{user.role === 'admin' ? <Pill tone="accent">Admin</Pill> : <Pill>Viewer</Pill>}</span>
              </div>
            </div>
          ) : <p className="muted">Not signed in.</p>}
          <p className="muted small">
            {user?.role === 'admin'
              ? 'Admins can upload files, edit people, change rules, and add or remove the people who can sign in.'
              : 'Viewers can see everything but cannot change anything. Ask an admin if you need a change made.'}
          </p>
          <div className="row-gap">
            {user?.role === 'admin' && <button className="btn sm" type="button" onClick={() => go('rules')}>Rules & calendars</button>}
            <button className="btn sm bad" type="button" onClick={() => void signOut()}>Sign out</button>
          </div>
        </Panel>

        <Panel title="Appearance" note="Remembered in this browser.">
          <div className="chips" role="radiogroup" aria-label="Theme">
            {([['', 'Same as this computer'], ['light', 'Light'], ['dark', 'Dark']] as const).map(([t, label]) => (
              <button key={t} type="button" role="radio" aria-checked={theme === t} className={`chip${theme === t ? ' on' : ''}`} onClick={() => pick(t)}>{label}</button>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Change password" note="You stay signed in here. Anywhere else you are signed in is signed out.">
        {usingSampleData ? <p className="muted">Passwords can only be changed on the real server.</p> : <PasswordForm />}
      </Panel>
    </>
  );
}

function PasswordForm() {
  const { toast } = useApp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    const problem = passwordProblem(next) ?? (next !== again ? 'The two new passwords are not the same.' : null);
    if (problem) { setError(problem); return; }
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setCurrent(''); setNext(''); setAgain('');
      toast('Password changed');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form narrow" onSubmit={save}>
      <label className="field" htmlFor="pw-current"><span>Current password</span><input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></label>
      <label className="field" htmlFor="pw-new"><span>New password</span><input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} aria-describedby="pw-new-rule" />
        <span id="pw-new-rule" className="muted small">{PASSWORD_RULE}</span>
      </label>
      <label className="field" htmlFor="pw-again"><span>New password again</span><input id="pw-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row-gap"><button className="btn pri" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button></div>
    </form>
  );
}
