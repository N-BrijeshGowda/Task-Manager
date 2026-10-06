import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/axios';
import { useToast } from '../context/ToastContext';
import { formatLong, isSaturday } from '../utils/dates';
import TaskForm from './TaskForm';
import TaskItem from './TaskItem';

export default function DayPanel({ date, info, onChanged }) {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');

  const type = info?.type || 'normal';

  useEffect(() => setNote(info?.note || ''), [date, info?.note]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tasks', { params: { date } });
      setTasks(data.tasks);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [date, toast]);

  useEffect(() => { load(); }, [load]);

  const addTask = async (values) => {
    try {
      await api.post('/tasks', { ...values, task_date: date });
      toast('Task added');
      await load();
      onChanged();
      return true;
    } catch (err) {
      toast(errorMessage(err), 'error');
      return false;
    }
  };

  const completePlanned = async (p) => {
    try {
      await api.patch(`/planned/${p.id}/complete`, {});
      toast('Done! Added to today’s completed tasks');
      await load();
      onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const markDay = async (next) => {
    try {
      if (next === 'normal') await api.delete(`/day-settings/${date}`);
      else await api.put(`/day-settings/${date}`, { type: next, note: next === 'working_saturday' ? '' : note });
      toast(next === 'normal' ? 'Day reset to normal' : 'Day updated');
      onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const options = [
    { value: 'normal', label: 'Normal' },
    { value: 'holiday', label: 'Holiday' },
    { value: 'leave', label: 'Leave' },
    ...(isSaturday(date) ? [{ value: 'working_saturday', label: 'Working Saturday' }] : []),
  ];

  return (
    <aside className="card day-panel">
      <h2>{formatLong(date)}</h2>

      <div className="mark-day">
        <span className="label">Mark day as</span>
        <div className="segmented">
          {options.map((o) => (
            <button
              key={o.value}
              className={type === o.value ? 'seg active' : 'seg'}
              onClick={() => type !== o.value && markDay(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {(type === 'holiday' || type === 'leave') && (
          <div className="note-row">
            <input
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={150}
            />
            <button className="btn btn-small" onClick={() => markDay(type)}>Save note</button>
          </div>
        )}
      </div>

      {info?.planned?.length > 0 && (
        <>
          <h3>Scheduled for this day</h3>
          <ul className="list">
            {info.planned.map((p) => (
              <li key={p.id} className={`item ${p.overdue ? 'item-overdue' : ''}`}>
                <button
                  className="check"
                  title="Mark as done (adds it to today's completed tasks)"
                  aria-label={`Mark "${p.title}" as done`}
                  onClick={() => completePlanned(p)}
                />
                <div className="item-main">
                  <div className="item-title">
                    <span className={`badge badge-${p.priority}`}>{p.priority}</span>
                    <strong>{p.title}</strong>
                    {p.overdue && <span className="tag tag-overdue">Overdue</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="hint">Edit or delete scheduled items in the <a href="#/planner">Planner</a>.</p>
        </>
      )}

      <h3>Completed tasks</h3>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : tasks.length ? (
        <ul className="list">
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} />
          ))}
        </ul>
      ) : (
        <p className="muted">Nothing logged for this day yet.</p>
      )}

      <h3>Add a task</h3>
      <TaskForm onSubmit={addTask} />
    </aside>
  );
}
