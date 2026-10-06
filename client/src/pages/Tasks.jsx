import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import TaskForm from '../components/TaskForm';
import TaskItem from '../components/TaskItem';

export default function Tasks() {
  const toast = useToast();
  const { refreshStats } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', priority: '', from: '', to: '' });

  const load = useCallback(async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const { data } = await api.get('/tasks', { params });
      setTasks(data.tasks);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  // Debounce so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });
  const hasFilters = Object.values(filters).some(Boolean);

  const run = async (action, message) => {
    try {
      await action();
      toast(message);
      await load();
      refreshStats();
      return true;
    } catch (err) {
      toast(errorMessage(err), 'error');
      return false;
    }
  };

  return (
    <div className="stack">
      <section className="card">
        <h2>Add a task</h2>
        <TaskForm showDate onSubmit={(v) => run(() => api.post('/tasks', v), 'Task added')} />
      </section>

      <section className="card">
        <h2>All tasks</h2>
        <div className="filters">
          <input className="grow" placeholder="Search tasks…" value={filters.q} onChange={set('q')} />
          <select value={filters.priority} onChange={set('priority')} aria-label="Priority filter">
            <option value="">Any priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <label className="inline">From <input type="date" value={filters.from} onChange={set('from')} /></label>
          <label className="inline">To <input type="date" value={filters.to} onChange={set('to')} /></label>
          {hasFilters && (
            <button className="btn btn-ghost" onClick={() => setFilters({ q: '', priority: '', from: '', to: '' })}>
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : tasks.length ? (
          <ul className="list">
            {tasks.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                showDate
                onUpdate={(id, v) => run(() => api.put(`/tasks/${id}`, v), 'Task updated')}
                onDelete={(id) => run(() => api.delete(`/tasks/${id}`), 'Task deleted')}
              />
            ))}
          </ul>
        ) : (
          <p className="muted">{hasFilters ? 'No tasks match those filters.' : 'No tasks yet. Add your first one above.'}</p>
        )}
      </section>
    </div>
  );
}
