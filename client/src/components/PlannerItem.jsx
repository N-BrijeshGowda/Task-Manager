import { useState } from 'react';
import PlannerForm from './PlannerForm';
import { formatDate } from '../utils/dates';

const REPEAT_TAG = { daily: 'daily', weekly: 'weekly', weekdays: 'weekdays' };

export default function PlannerItem({ item, onComplete, onReschedule, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const done = item.status === 'done';

  if (editing) {
    return (
      <li className="item">
        <PlannerForm
          initial={item}
          onSubmit={async (values) => {
            const ok = await onUpdate(item.id, values);
            if (ok) setEditing(false);
            return ok;
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className={`item ${item.overdue ? 'item-overdue' : ''} ${done ? 'item-done' : ''}`}>
      {!done && (
        <button
          className="check"
          title="Mark as done"
          aria-label={`Mark "${item.title}" as done`}
          onClick={() => onComplete(item.id)}
        />
      )}
      {done && <span className="check checked" aria-hidden="true">✓</span>}

      <div className="item-main">
        <div className="item-title">
          <span className={`badge badge-${item.priority}`}>{item.priority}</span>
          <strong>{item.title}</strong>
          {item.overdue && <span className="tag tag-overdue">Overdue</span>}
          {item.scope === 'week' && <span className="tag">week</span>}
          {REPEAT_TAG[item.recurrence] && <span className="tag">↻ {REPEAT_TAG[item.recurrence]}</span>}
        </div>
        {item.description && <p className="item-desc">{item.description}</p>}
        <p className="item-meta">
          {done
            ? `Completed ${item.completed_at ? formatDate(item.completed_at.slice(0, 10)) : ''}`
            : `${item.scope === 'week' ? 'Due by end of week: ' : 'Due: '}${formatDate(item.due_date)}`}
        </p>
      </div>

      <div className="item-actions">
        {!done && item.overdue && (
          <button className="btn btn-small" onClick={() => onReschedule(item.id)}>Move to today</button>
        )}
        {!done && <button className="btn btn-small" onClick={() => setEditing(true)}>Edit</button>}
        <button
          className="btn btn-small btn-danger"
          onClick={() => window.confirm(`Delete "${item.title}"?`) && onDelete(item.id)}
        >
          Delete
        </button>
      </div>
    </li>
  );
}
