const express = require('express');
const db = require('../config/db');
const wrap = require('../utils/wrap');
const { isDate, today, monthRange, dayOfWeek } = require('../utils/dates');
const { readjustWeekly } = require('../utils/workdays');
const { logEvent } = require('../utils/audit');

const router = express.Router();

// GET /api/calendar?month=YYYY-MM  ->  { days: { 'YYYY-MM-DD': { count, type, note, overdue } } }
router.get('/calendar', wrap(async (req, res) => {
  const { month } = req.query;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) return res.status(400).json({ message: 'Invalid month' });
  const { from, to } = monthRange(month);

  const [counts] = await db.query(
    `SELECT task_date AS date, COUNT(*) AS count FROM tasks
     WHERE user_id = ? AND task_date BETWEEN ? AND ? GROUP BY task_date`,
    [req.userId, from, to]
  );
  const [settings] = await db.query(
    'SELECT date, type, note FROM day_settings WHERE user_id = ? AND date BETWEEN ? AND ?',
    [req.userId, from, to]
  );
  const [overdue] = await db.query(
    `SELECT due_date AS date FROM planned_tasks
     WHERE user_id = ? AND status = 'pending' AND due_date < ? AND due_date BETWEEN ? AND ?
     GROUP BY due_date`,
    [req.userId, today(), from, to]
  );

  const days = {};
  const get = (d) => (days[d] = days[d] || { count: 0, type: null, note: null, overdue: false });
  counts.forEach((r) => { get(r.date).count = r.count; });
  settings.forEach((r) => { Object.assign(get(r.date), { type: r.type, note: r.note }); });
  overdue.forEach((r) => { get(r.date).overdue = true; });
  res.json({ days });
}));

// PUT /api/day-settings/:date  { type: 'holiday' | 'leave' | 'working_saturday', note }
router.put('/day-settings/:date', wrap(async (req, res) => {
  const { date } = req.params;
  const { type } = req.body;
  if (!isDate(date)) return res.status(400).json({ message: 'Invalid date' });
  if (!['holiday', 'leave', 'working_saturday'].includes(type)) {
    return res.status(400).json({ message: 'Invalid day type' });
  }
  if (type === 'working_saturday' && dayOfWeek(date) !== 6) {
    return res.status(400).json({ message: 'Only a Saturday can be a working Saturday' });
  }
  const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 150) : '';

  await db.query(
    `INSERT INTO day_settings (user_id, date, type, note) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE type = VALUES(type), note = VALUES(note)`,
    [req.userId, date, type, note || null]
  );
  await readjustWeekly(req.userId, date);
  logEvent(req, 'day_mark');
  res.json({ date, type, note: note || null });
}));

// DELETE /api/day-settings/:date  -> back to a normal day
router.delete('/day-settings/:date', wrap(async (req, res) => {
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ message: 'Invalid date' });
  await db.query('DELETE FROM day_settings WHERE user_id = ? AND date = ?', [req.userId, date]);
  await readjustWeekly(req.userId, date);
  logEvent(req, 'day_reset');
  res.json({ date });
}));

module.exports = router;
