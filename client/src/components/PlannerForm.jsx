import { useState } from 'react';
import { todayISO } from '../utils/dates';

const REPEAT_LABELS = {
  none: 'Does not repeat',
  daily: 'Repeats daily',
  weekly: 'Repeats weekly',
  weekdays: 'Repeats on weekdays',
};

export default function PlannerForm({ initial, onSubmit, onCancel }) {
  const editing = !!initial;
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    priority: initial?.priority || 'medium',
    scope: initial?.scope || 'day',
    due_date: initial?.due_date || todayISO(),
    week_of: editing ? '' : todayISO(),
    recurrence: initial?.recurrence || 'none',
  });
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const setScope = (e) => {
    const scope = e.target.value;
    // Daily / weekdays only make sense for day items.
    const recurrence = scope === 'week' && ['daily', 'weekdays'].includes(form.recurrence) ? 'none' : form.recurrence;
    setForm({ ...form, scope, recurrence });
  };

  const repeatOptions = form.scope === 'week' ? ['none', 'weekly'] : ['none', 'daily', 'weekly', 'weekdays'];

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      const ok = await onSubmit(form);
      if (ok !== false && !editing) setForm({ ...form, title: '', description: '' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <input
        className="grow"
        placeholder="What do you want to achieve?"
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

      <select value={form.scope} onChange={setScope} disabled={editing} aria-label="Type">
        <option value="day">Due on a day</option>
        <option value="week">Due by end of week</option>
      </select>
      {form.scope === 'day' ? (
        <input type="date" value={form.due_date} onChange={set('due_date')} required aria-label="Due date" />
      ) : (
        <label className="inline">
          {editing ? 'Move to week of' : 'Week of'}
          <input type="date" value={form.week_of} onChange={set('week_of')} required={!editing} />
        </label>
      )}
      <select value={form.recurrence} onChange={set('recurrence')} aria-label="Repeat">
        {repeatOptions.map((r) => <option key={r} value={r}>{REPEAT_LABELS[r]}</option>)}
      </select>

      {form.scope === 'week' && (
        <p className="hint full">
          Weekly items are due on Saturday if it is marked as a working Saturday, otherwise Friday.
        </p>
      )}
      <textarea
        className="full"
        placeholder="Notes (optional)"
        value={form.description}
        onChange={set('description')}
        rows={2}
      />
      <div className="full actions">
        <button className="btn btn-primary" disabled={busy}>{editing ? 'Save' : 'Add to planner'}</button>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
