import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/axios';
import { useToast } from '../context/ToastContext';

const EVENT_LABELS = {
  register: 'Signed up',
  login: 'Logged in',
  login_failed: 'Failed login',
  login_blocked: 'Blocked login (disabled)',
  task_create: 'Task added',
  task_update: 'Task edited',
  task_delete: 'Task deleted',
  planned_create: 'Plan added',
  planned_update: 'Plan edited',
  planned_delete: 'Plan deleted',
  planned_complete: 'Plan completed',
  planned_reschedule: 'Plan rescheduled',
  day_mark: 'Day marked',
  day_reset: 'Day reset',
  admin_disable_user: 'Admin disabled a user',
  admin_enable_user: 'Admin enabled a user',
  admin_delete_user: 'Admin deleted a user',
  admin_reset_password: 'Admin reset a password',
  password_changed: 'Changed password',
};

const eventClass = (e) =>
  e === 'login_failed' || e === 'login_blocked' ? 'ev-bad' : e.startsWith('admin_') ? 'ev-admin' : '';

const fmtTime = (s) => (s ? s.replace('T', ' ').slice(0, 16) : '—');

// A user reference in the log. Name/email are empty if the account has since been deleted.
function Who({ id, name, email }) {
  if (!name) return <span className="muted">#{id} (deleted)</span>;
  return <span title={email}>{name} <span className="muted">#{id}</span></span>;
}

function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button className="btn btn-small" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Prev</button>
      <span className="muted">Page {page} of {pages}</span>
      <button className="btn btn-small" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next ›</button>
    </div>
  );
}

function Overview() {
  const toast = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/admin/overview').then((r) => setData(r.data)).catch((e) => toast(errorMessage(e), 'error'));
  }, [toast]);

  if (!data) return <p className="muted">Loading…</p>;
  const cards = [
    ['Total users', data.users.total],
    ['Active accounts', data.users.active],
    ['Disabled accounts', data.users.disabled],
    ['New (7 days)', data.users.new7d],
    ['Logged in (7 days)', data.users.active7d],
    ['Tasks logged', data.tasksLogged],
    ['Plans pending', data.planned.pending],
    ['Plans completed', data.planned.done],
    ['Logins (24h)', data.last24h.logins],
    ['Failed logins (24h)', data.last24h.failedLogins],
  ];
  return (
    <div className="stats stats-wide">
      {cards.map(([label, value]) => (
        <div className="stat" key={label}><b>{value}</b><span>{label}</span></div>
      ))}
    </div>
  );
}

function Users() {
  const toast = useToast();
  const [data, setData] = useState({ users: [], page: 1, pages: 1, total: 0 });
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [temp, setTemp] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get('/admin/users', { params: { page, status: status || undefined, q: q || undefined } });
      setData(d);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, status, q, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const resetPassword = async (u) => {
    if (!window.confirm(`Reset the password for ${u.name}? They will not be able to log in with their old password.`)) return;
    try {
      const { data: d } = await api.post(`/admin/users/${u.id}/reset-password`);
      setTemp({ name: u.name, email: u.email, password: d.temporaryPassword });
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const copyTemp = async () => {
    try {
      await navigator.clipboard.writeText(temp.password);
      toast('Copied');
    } catch {
      toast('Copy failed, select the password and copy it manually', 'error');
    }
  };

  const act = async (fn, message) => {
    try {
      await fn();
      toast(message);
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <div className="filters">
        <input className="grow" placeholder="Search name or email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status filter">
          <option value="">All accounts</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <span className="muted">{data.total} account{data.total === 1 ? '' : 's'}</span>
      </div>
      <p className="hint">You can see names, emails and activity counts. Task and plan content is never shown to admins. Disabling an account keeps all of its data.</p>

      {temp && (
        <div className="temp-pw">
          <p><b>Temporary password for {temp.name}</b> ({temp.email}). It is shown only once, so give it to the user now. They will have to choose a new password when they log in.</p>
          <div className="temp-row">
            <code>{temp.password}</code>
            <button className="btn btn-small" onClick={copyTemp}>Copy</button>
            <button className="btn btn-small btn-ghost" onClick={() => setTemp(null)}>Done</button>
          </div>
        </div>
      )}

      {loading ? <p className="muted">Loading…</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th><th>Email</th><th>Status</th><th>Joined</th><th>Last login</th>
                <th>Tasks</th><th>Plans pending</th><th>Plans done</th><th />
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.name}</b> <span className="muted">#{u.id}</span> {u.role === 'admin' && <span className="tag">admin</span>}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={u.is_active ? 'pill pill-ok' : 'pill pill-off'}>
                      {u.is_active ? 'Active' : 'Disabled'}
                    </span>
                    {u.must_change_password && <span className="tag" title="Has a temporary password">temp pw</span>}
                  </td>
                  <td>{fmtTime(u.created_at).slice(0, 10)}</td>
                  <td>{fmtTime(u.last_login_at)}</td>
                  <td>{u.tasks_logged}</td>
                  <td>{u.planned_pending}</td>
                  <td>{u.planned_done}</td>
                  <td className="row-actions">
                    {u.role !== 'admin' && (
                      <>
                        <button
                          className="btn btn-small"
                          onClick={() => act(
                            () => api.patch(`/admin/users/${u.id}/status`, { active: !u.is_active }),
                            u.is_active ? `${u.name} disabled` : `${u.name} enabled`
                          )}
                        >
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button className="btn btn-small" onClick={() => resetPassword(u)}>Reset password</button>
                        <button
                          className="btn btn-small btn-danger"
                          onClick={() =>
                            window.confirm(`Permanently delete ${u.name} (${u.email}) and ALL of their data? This cannot be undone.`) &&
                            act(() => api.delete(`/admin/users/${u.id}`), `${u.name} deleted`)
                          }
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!data.users.length && <tr><td colSpan="9" className="muted">No accounts.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={data.page} pages={data.pages} onPage={setPage} />
    </>
  );
}

function Logs() {
  const toast = useToast();
  const [data, setData] = useState({ logs: [], page: 1, pages: 1, total: 0, events: [] });
  const [filters, setFilters] = useState({ event: '', user_id: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const params = Object.fromEntries(Object.entries({ ...filters, page }).filter(([, v]) => v));
      const { data: d } = await api.get('/admin/logs', { params });
      setData(d);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const set = (key) => (e) => { setFilters({ ...filters, [key]: e.target.value }); setPage(1); };

  return (
    <>
      <div className="filters">
        <select value={filters.event} onChange={set('event')} aria-label="Event filter">
          <option value="">All events</option>
          {data.events.map((ev) => <option key={ev} value={ev}>{EVENT_LABELS[ev] || ev}</option>)}
        </select>
        <input type="number" min="1" placeholder="User #" value={filters.user_id} onChange={set('user_id')} style={{ width: '6.5rem' }} />
        <label className="inline">From <input type="date" value={filters.from} onChange={set('from')} /></label>
        <label className="inline">To <input type="date" value={filters.to} onChange={set('to')} /></label>
        <button className="btn btn-ghost" onClick={() => { setFilters({ event: '', user_id: '', from: '', to: '' }); setPage(1); }}>
          Clear
        </button>
        <span className="muted">{data.total} entr{data.total === 1 ? 'y' : 'ies'}</span>
      </div>
      <p className="hint">Logs record what happened, who did it and from which IP. They never contain task or plan content. Times are server time.</p>

      {loading ? <p className="muted">Loading…</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Time</th><th>User</th><th>Event</th><th>Target</th><th>IP</th></tr></thead>
            <tbody>
              {data.logs.map((l) => (
                <tr key={l.id}>
                  <td>{fmtTime(l.created_at)}</td>
                  <td>{l.user_id ? <Who id={l.user_id} name={l.user_name} email={l.user_email} /> : '—'}</td>
                  <td><span className={`ev ${eventClass(l.event)}`}>{EVENT_LABELS[l.event] || l.event}</span></td>
                  <td>{l.target_user_id ? <Who id={l.target_user_id} name={l.target_name} email={l.target_email} /> : ''}</td>
                  <td className="muted">{l.ip || '—'}</td>
                </tr>
              ))}
              {!data.logs.length && <tr><td colSpan="5" className="muted">No log entries match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={data.page} pages={data.pages} onPage={setPage} />
    </>
  );
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'logs', label: 'Activity logs' },
];

export default function Admin() {
  const [tab, setTab] = useState('overview');
  return (
    <section className="card">
      <h2>Admin</h2>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'tab active' : 'tab'} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'users' && <Users />}
      {tab === 'logs' && <Logs />}
    </section>
  );
}
