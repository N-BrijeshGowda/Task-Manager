// Admin API.
// The admin may see each user's name, email, status and activity counts.
// PRIVACY RULE: these queries must never select password_hash, or any content (titles,
// descriptions, notes) from tasks / planned_tasks / day_settings. Only ids, dates, flags and counts.
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const wrap = require('../utils/wrap');
const { isDate } = require('../utils/dates');
const { EVENTS, logEvent } = require('../utils/audit');

const router = express.Router();

const PAGE_SIZE = 25;
const LOG_PAGE_SIZE = 50;

const pageOf = (v) => Math.max(1, parseInt(v, 10) || 1);

// Random temporary password without look-alike characters (no 0/O, 1/l/I).
const TEMP_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const makeTempPassword = (len = 10) =>
  Array.from(crypto.randomBytes(len), (b) => TEMP_CHARS[b % TEMP_CHARS.length]).join('');

router.get('/overview', wrap(async (req, res) => {
  const [[u]] = await db.query(
    `SELECT COUNT(*) AS total,
            SUM(is_active = 1) AS active,
            SUM(is_active = 0) AS disabled,
            SUM(created_at >= NOW() - INTERVAL 7 DAY) AS new_7d,
            SUM(last_login_at >= NOW() - INTERVAL 7 DAY) AS active_7d
     FROM users`
  );
  const [[t]] = await db.query('SELECT COUNT(*) AS n FROM tasks');
  const [[p]] = await db.query(
    `SELECT SUM(status = 'pending') AS pending, SUM(status = 'done') AS done FROM planned_tasks`
  );
  const [[l]] = await db.query(
    `SELECT SUM(event = 'login') AS logins, SUM(event = 'login_failed') AS failed
     FROM activity_logs WHERE created_at >= NOW() - INTERVAL 1 DAY`
  );

  res.json({
    users: {
      total: u.total, active: Number(u.active || 0), disabled: Number(u.disabled || 0),
      new7d: Number(u.new_7d || 0), active7d: Number(u.active_7d || 0),
    },
    tasksLogged: t.n,
    planned: { pending: Number(p.pending || 0), done: Number(p.done || 0) },
    last24h: { logins: Number(l.logins || 0), failedLogins: Number(l.failed || 0) },
  });
}));

// GET /api/admin/users?page=&status=&q=   (q searches name and email)
router.get('/users', wrap(async (req, res) => {
  const page = pageOf(req.query.page);
  const where = [];
  const params = [];
  if (req.query.status === 'active') where.push('u.is_active = 1');
  if (req.query.status === 'disabled') where.push('u.is_active = 0');
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const like = `%${req.query.q.trim().slice(0, 100)}%`;
    where.push('(u.name LIKE ? OR u.email LIKE ?)');
    params.push(like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[count]] = await db.query(`SELECT COUNT(*) AS n FROM users u ${clause}`, params);
  const [rows] = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.must_change_password, u.created_at, u.last_login_at,
            (SELECT COUNT(*) FROM tasks t WHERE t.user_id = u.id) AS tasks_logged,
            (SELECT COUNT(*) FROM planned_tasks p WHERE p.user_id = u.id AND p.status = 'pending') AS planned_pending,
            (SELECT COUNT(*) FROM planned_tasks p WHERE p.user_id = u.id AND p.status = 'done') AS planned_done
     FROM users u ${clause}
     ORDER BY u.id DESC LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]
  );
  res.json({
    users: rows.map((r) => ({ ...r, is_active: !!r.is_active, must_change_password: !!r.must_change_password })),
    total: count.n,
    page,
    pages: Math.max(1, Math.ceil(count.n / PAGE_SIZE)),
  });
}));

// Loads the target user and refuses to touch admins or the admin's own account.
async function loadTarget(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) { res.status(400).json({ message: 'Invalid user' }); return null; }
  const [rows] = await db.query('SELECT id, role FROM users WHERE id = ?', [id]);
  if (!rows[0]) { res.status(404).json({ message: 'User not found' }); return null; }
  if (rows[0].role === 'admin' || id === req.userId) {
    res.status(400).json({ message: 'Admin accounts cannot be changed here' });
    return null;
  }
  return rows[0];
}

// Disabling blocks login but keeps all of the user's data.
router.patch('/users/:id/status', wrap(async (req, res) => {
  if (typeof req.body.active !== 'boolean') return res.status(400).json({ message: 'active must be true or false' });
  const target = await loadTarget(req, res);
  if (!target) return;
  await db.query('UPDATE users SET is_active = ? WHERE id = ?', [req.body.active ? 1 : 0, target.id]);
  logEvent(req, req.body.active ? 'admin_enable_user' : 'admin_disable_user', { targetUserId: target.id });
  res.json({ id: target.id, is_active: req.body.active });
}));

// Sets a random temporary password and returns it ONCE. Only the hash is stored, and the user
// must choose their own password at the next login.
router.post('/users/:id/reset-password', wrap(async (req, res) => {
  const target = await loadTarget(req, res);
  if (!target) return;
  const temporaryPassword = makeTempPassword();
  await db.query(
    'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?',
    [await bcrypt.hash(temporaryPassword, 10), target.id]
  );
  logEvent(req, 'admin_reset_password', { targetUserId: target.id });
  res.json({ id: target.id, temporaryPassword });
}));

// Deleting removes the user's tasks, plans and day markers too (ON DELETE CASCADE).
router.delete('/users/:id', wrap(async (req, res) => {
  const target = await loadTarget(req, res);
  if (!target) return;
  await db.query('DELETE FROM users WHERE id = ?', [target.id]);
  logEvent(req, 'admin_delete_user', { targetUserId: target.id });
  res.json({ id: target.id });
}));

// GET /api/admin/logs?page=&event=&user_id=&from=&to=
router.get('/logs', wrap(async (req, res) => {
  const page = pageOf(req.query.page);
  const { event, user_id: userId, from, to } = req.query;
  const where = [];
  const params = [];

  if (event && EVENTS.includes(event)) { where.push('l.event = ?'); params.push(event); }
  if (userId && parseInt(userId, 10)) {
    where.push('(l.user_id = ? OR l.target_user_id = ?)');
    params.push(parseInt(userId, 10), parseInt(userId, 10));
  }
  if (from && isDate(from)) { where.push('l.created_at >= ?'); params.push(`${from} 00:00:00`); }
  if (to && isDate(to)) { where.push('l.created_at <= ?'); params.push(`${to} 23:59:59`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[count]] = await db.query(`SELECT COUNT(*) AS n FROM activity_logs l ${clause}`, params);
  // Names/emails come from the users table (NULL once an account has been deleted).
  const [rows] = await db.query(
    `SELECT l.id, l.user_id, l.event, l.target_user_id, l.ip, l.created_at,
            u.name AS user_name, u.email AS user_email,
            t.name AS target_name, t.email AS target_email
     FROM activity_logs l
     LEFT JOIN users u ON u.id = l.user_id
     LEFT JOIN users t ON t.id = l.target_user_id
     ${clause} ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    [...params, LOG_PAGE_SIZE, (page - 1) * LOG_PAGE_SIZE]
  );
  res.json({
    logs: rows,
    total: count.n,
    page,
    pages: Math.max(1, Math.ceil(count.n / LOG_PAGE_SIZE)),
    events: EVENTS,
  });
}));

module.exports = router;
