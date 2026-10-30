import { useState, type FormEvent } from 'react';
import { api } from '../api';
import type { User } from '../types';
import { PASSWORD_RULE, passwordProblem } from '../lib/password';

/** Sign-in, or the one-time "create the first admin" form on a fresh install. */
export function Login({ firstRun, onDone }: { firstRun: boolean; onDone: (u: User) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (firstRun) {
      const problem = passwordProblem(password);
      if (problem) { setError(problem); return; }
    }
    setBusy(true);
    try {
      onDone(firstRun ? await api.setup(name, email, password) : await api.login(email, password));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
        <span>Attendance Desk<small>AMIPI attendance, kept up to date automatically</small></span>
      </div>
      <form className="panel" onSubmit={submit}>
        <h1>{firstRun ? 'Create the first admin account' : 'Sign in'}</h1>
        {firstRun && <p className="muted">This is a new installation. The account you create here can add other people later.</p>}
        {firstRun && (
          <label className="field" htmlFor="login-name"><span>Your name</span>
            <input id="login-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
        )}
        <label className="field" htmlFor="login-email"><span>Email</span>
          <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </label>
        <label className="field" htmlFor="login-password"><span>Password</span>
          <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={firstRun ? 8 : undefined} autoComplete={firstRun ? 'new-password' : 'current-password'} aria-describedby={firstRun ? 'pw-rule' : undefined} />
          {firstRun && <span id="pw-rule" className="muted small">{PASSWORD_RULE}</span>}
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Please wait…' : firstRun ? 'Create account' : 'Sign in'}</button>
      </form>
    </div>
  );
}
