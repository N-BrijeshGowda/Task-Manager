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

  const updateTask = async (id, values) => {
    try {
      await api.put(`/tasks/${id}`, values);
      toast('Task updated');
      await load();
      onChanged();
      return true;
    } catch (err) {
      toast(errorMessage(err), 'error');
      return false;
    }
  };

  const deleteTask = async (id) => {
    try {
      await api.delete(`/tasks/${id}`);
      toast('Task deleted');
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

      <h3>Completed tasks</h3>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : tasks.length ? (
        <ul className="list">
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} onUpdate={updateTask} onDelete={deleteTask} />
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
