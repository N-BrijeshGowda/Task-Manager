import { useState } from 'react';
import api, { errorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';

// Shown instead of the app after an admin has set a temporary password.
export default function ChangePassword() {
  const { user, logout, passwordChanged } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.next !== form.confirm) return setError('The new passwords do not match');
    setBusy(true);
    try {
      await api.post('/auth/change-password', { current_password: form.current, new_password: form.next });
      passwordChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>Set a new password</h1>
        <p className="muted">
          Hi {user.name}, an administrator reset your password. Enter the temporary password you were
          given, then choose your own.
        </p>
        <label>
          Temporary password
          <input type="password" value={form.current} onChange={set('current')} required autoFocus />
        </label>
        <label>
          New password
          <input type="password" value={form.next} onChange={set('next')} minLength={6} required />
        </label>
        <label>
          Confirm new password
          <input type="password" value={form.confirm} onChange={set('confirm')} minLength={6} required />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
        <button type="button" className="btn btn-ghost" onClick={logout}>Log out</button>
      </form>
    </div>
  );
}
