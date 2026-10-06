const express = require('express');
const db = require('../config/db');
const wrap = require('../utils/wrap');
const { logEvent } = require('../utils/audit');
const { isDate, today, monthRange } = require('../utils/dates');
const { cleanText, priorityOr, PRIORITIES } = require('../utils/validate');

const router = express.Router();

// GET /api/tasks?date=&month=&q=&priority=&from=&to=
router.get('/', wrap(async (req, res) => {
  const { date, month, q, priority, from, to } = req.query;
  const where = ['user_id = ?'];
  const params = [req.userId];

  if (date) {
    if (!isDate(date)) return res.status(400).json({ message: 'Invalid date' });
    where.push('task_date = ?');
    params.push(date);
  }
  if (month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ message: 'Invalid month' });
    const range = monthRange(month);
    where.push('task_date BETWEEN ? AND ?');
    params.push(range.from, range.to);
  }
  if (from && isDate(from)) { where.push('task_date >= ?'); params.push(from); }
  if (to && isDate(to)) { where.push('task_date <= ?'); params.push(to); }
  if (priority && PRIORITIES.includes(priority)) { where.push('priority = ?'); params.push(priority); }
  if (q && typeof q === 'string' && q.trim()) {
    where.push('(title LIKE ? OR description LIKE ?)');
    const like = `%${q.trim().slice(0, 100)}%`;
    params.push(like, like);
  }

  const [rows] = await db.query(
    `SELECT id, title, description, task_date, priority, planned_id, created_at
     FROM tasks WHERE ${where.join(' AND ')}
     ORDER BY task_date DESC, id DESC LIMIT 500`,
    params
  );
  res.json({ tasks: rows });
}));

router.post('/', wrap(async (req, res) => {
  const title = cleanText(req.body.title, 200);
  if (!title) return res.status(400).json({ message: 'Title is required' });
  const taskDate = req.body.task_date || today();
  if (!isDate(taskDate)) return res.status(400).json({ message: 'Invalid date' });

  const [result] = await db.query(
    'INSERT INTO tasks (user_id, title, description, task_date, priority) VALUES (?, ?, ?, ?, ?)',
    [req.userId, title, cleanText(req.body.description, 5000) || null, taskDate, priorityOr(req.body.priority)]
  );
  logEvent(req, 'task_create');
  const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
  res.status(201).json({ task: rows[0] });
}));

router.put('/:id', wrap(async (req, res) => {
  const title = cleanText(req.body.title, 200);
  if (!title) return res.status(400).json({ message: 'Title is required' });
  const taskDate = req.body.task_date;
  if (!isDate(taskDate)) return res.status(400).json({ message: 'Invalid date' });

  const [result] = await db.query(
    `UPDATE tasks SET title = ?, description = ?, task_date = ?, priority = ?
     WHERE id = ? AND user_id = ?`,
    [title, cleanText(req.body.description, 5000) || null, taskDate, priorityOr(req.body.priority), req.params.id, req.userId]
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Task not found' });
  logEvent(req, 'task_update');
  const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  res.json({ task: rows[0] });
}));

router.delete('/:id', wrap(async (req, res) => {
  const [result] = await db.query('DELETE FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!result.affectedRows) return res.status(404).json({ message: 'Task not found' });
  logEvent(req, 'task_delete');
  res.json({ message: 'Task deleted' });
}));

module.exports = router;
