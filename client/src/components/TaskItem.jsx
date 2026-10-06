import { useState } from 'react';
import TaskForm from './TaskForm';
import { formatDate } from '../utils/dates';

export default function TaskItem({ task, showDate, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="item">
        <TaskForm
          initial={task}
          showDate
          submitLabel="Save"
          onSubmit={async (values) => {
            const ok = await onUpdate(task.id, values);
            if (ok) setEditing(false);
            return ok;
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="item">
      <div className="item-main">
        <div className="item-title">
          <span className={`badge badge-${task.priority}`}>{task.priority}</span>
          <strong>{task.title}</strong>
          {task.planned_id && <span className="tag" title="Completed from the planner">planned</span>}
        </div>
        {task.description && <p className="item-desc">{task.description}</p>}
        {showDate && <p className="item-meta">{formatDate(task.task_date)}</p>}
      </div>
      {onUpdate && onDelete && (
        <div className="item-actions">
          <button className="btn btn-small" onClick={() => setEditing(true)}>Edit</button>
          <button
            className="btn btn-small btn-danger"
            onClick={() => window.confirm(`Delete "${task.title}"?`) && onDelete(task.id)}
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
