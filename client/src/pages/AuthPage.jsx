import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/axios';

export default function AuthPage({ mode }) {
  const { login, register } = useAuth();
  const isRegister = mode === 'register';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isRegister) await register(form.name, form.email, form.password);
      else await login(form.email, form.password);
      window.location.hash = '#/';
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>Daily Task Tracker</h1>
        <p className="muted">{isRegister ? 'Create your account' : 'Log in to see your calendar'}</p>

        {isRegister && (
          <label>
            Name
            <input value={form.name} onChange={set('name')} required autoFocus />
          </label>
        )}
        <label>
          Email
          <input type="email" value={form.email} onChange={set('email')} required autoFocus={!isRegister} />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            minLength={isRegister ? 6 : undefined}
            required
          />
        </label>

        {error && <div className="form-error">{error}</div>}

        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
        </button>

        <p className="muted switch">
          {isRegister ? (
            <>Already have an account? <a href="#/login">Log in</a></>
          ) : (
            <>New here? <a href="#/register">Create an account</a></>
          )}
        </p>
      </form>
    </div>
  );
}
