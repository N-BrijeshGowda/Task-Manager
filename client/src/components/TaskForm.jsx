import { useState } from 'react';
import { todayISO } from '../utils/dates';

export default function TaskForm({ initial, showDate, submitLabel = 'Add task', onSubmit, onCancel }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    priority: initial?.priority || 'medium',
    task_date: initial?.task_date || todayISO(),
  });
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      const ok = await onSubmit(form);
      if (ok !== false && !initial) setForm({ ...form, title: '', description: '' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <input
        className="grow"
        placeholder="What did you get done?"
        value={form.title}
        onChange={set('title')}
        maxLength={200}
        required
      />
      <select value={form.priority} onChange={set('priority')} aria-label="Priority">
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
      {showDate && <input type="date" value={form.task_date} onChange={set('task_date')} required />}
      <textarea
        className="full"
        placeholder="Notes (optional)"
        value={form.description}
        onChange={set('description')}
        rows={2}
      />
      <div className="full actions">
        <button className="btn btn-primary" disabled={busy}>{submitLabel}</button>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
