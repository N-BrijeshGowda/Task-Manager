import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PlannerForm from '../components/PlannerForm';
import PlannerItem from '../components/PlannerItem';

const TABS = [
  { key: 'all', label: 'All pending' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'done', label: 'Done' },
];

const EMPTY = {
  all: 'Nothing planned. Add something you want to achieve above.',
  today: 'Nothing due today.',
  week: 'Nothing due this week.',
  overdue: 'No overdue items. Nice work!',
  done: 'Nothing completed yet.',
};

export default function Planner() {
  const toast = useToast();
  const { refreshStats } = useAuth();
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/planned', { params: { filter } });
      setItems(data.planned);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const run = async (action, message) => {
    try {
      const res = await action();
      toast(typeof message === 'function' ? message(res) : message);
      await load();
      refreshStats();
      return true;
    } catch (err) {
      toast(errorMessage(err), 'error');
      return false;
    }
  };

  // The form sends everything; the API picks what applies for the item's type.
  const payload = (v) => ({
    title: v.title,
    description: v.description,
    priority: v.priority,
    scope: v.scope,
    due_date: v.due_date,
    week_of: v.week_of || undefined,
    recurrence: v.recurrence,
  });

  const overdueCount = items.filter((i) => i.overdue).length;

  return (
    <div className="stack">
      <section className="card">
        <h2>Plan something</h2>
        <PlannerForm onSubmit={(v) => run(() => api.post('/planned', payload(v)), 'Added to planner')} />
      </section>

      <section className="card">
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.key} className={filter === t.key ? 'tab active' : 'tab'} onClick={() => setFilter(t.key)}>
              {t.label}
            </button>
          ))}
          {overdueCount > 0 && filter !== 'done' && (
            <button
              className="btn btn-small tabs-action"
              onClick={() => run(() => api.post('/planned/reschedule-overdue'), (r) => `Moved ${r.data.moved} item(s)`)}
            >
              Reschedule all overdue ({overdueCount})
            </button>
          )}
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : items.length ? (
          <ul className="list">
            {items.map((item) => (
              <PlannerItem
                key={item.id}
                item={item}
                onComplete={(id) =>
                  run(() => api.patch(`/planned/${id}/complete`, {}), 'Done! Added to today’s completed tasks')
                }
                onReschedule={(id) => run(() => api.patch(`/planned/${id}/reschedule`), 'Rescheduled')}
                onUpdate={(id, v) => run(() => api.put(`/planned/${id}`, payload(v)), 'Updated')}
                onDelete={(id) => run(() => api.delete(`/planned/${id}`), 'Deleted')}
              />
            ))}
          </ul>
        ) : (
          <p className="muted">{EMPTY[filter]}</p>
        )}
      </section>
    </div>
  );
}
