// Activity log for the admin. PRIVACY RULE: only an event name, user ids and the IP are stored.
// Never put task/plan content, passwords or other user-entered text in here (names and emails
// are looked up from the users table when the admin views the log, not stored in it).
const db = require('../config/db');

const EVENTS = [
  'register', 'login', 'login_failed', 'login_blocked',
  'task_create', 'task_update', 'task_delete',
  'planned_create', 'planned_update', 'planned_delete', 'planned_complete', 'planned_reschedule',
  'day_mark', 'day_reset',
  'password_changed',
  'admin_disable_user', 'admin_enable_user', 'admin_delete_user', 'admin_reset_password',
];

// Fire and forget: a logging problem must never break the user's request.
function logEvent(req, event, { userId = req.userId ?? null, targetUserId = null } = {}) {
  const ip = (req.ip || '').replace('::ffff:', '').slice(0, 45) || null;
  db.query(
    'INSERT INTO activity_logs (user_id, event, target_user_id, ip) VALUES (?, ?, ?, ?)',
    [userId, event, targetUserId, ip]
  ).catch((err) => console.error('Could not write activity log:', err.message));
}

module.exports = { EVENTS, logEvent };
