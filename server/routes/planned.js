const express = require('express');
const db = require('../config/db');
const wrap = require('../utils/wrap');
const { logEvent } = require('../utils/audit');
const { isDate, today, nowStamp, addDays, dayOfWeek, mondayOf } = require('../utils/dates');
const { cleanText, priorityOr } = require('../utils/validate');
const { nextWorkingDay, weekEnd } = require('../utils/workdays');

const router = express.Router();

const RECURRENCE = {
  day: ['none', 'daily', 'weekly', 'weekdays'],
  week: ['none', 'weekly'],
};

const withOverdue = (rows) => {
  const t = today();
  return rows.map((r) => ({ ...r, overdue: r.status === 'pending' && r.due_date < t }));
};

// Due date of the next occurrence of a recurring item (always in the future).
async function nextDueDate(userId, item, conn) {
  const t = today();

  if (item.scope === 'week') {
    let ref = addDays(mondayOf(item.due_date), 7);
    let end = await weekEnd(userId, ref, { shift: false }, conn);
    while (end <= t) {
      ref = addDays(ref, 7);
      end = await weekEnd(userId, ref, { shift: false }, conn);
    }
    return end;
  }

  const advance = (d) => {
    if (item.recurrence === 'daily') return addDays(d, 1);
    if (item.recurrence === 'weekly') return addDays(d, 7);
    let n = addDays(d, 1); // weekdays
    while (dayOfWeek(n) === 0 || dayOfWeek(n) === 6) n = addDays(n, 1);
    return n;
  };
  let next = advance(item.due_date);
  while (next <= t) next = advance(next);
  return nextWorkingDay(userId, next, conn);
}

// GET /api/planned?filter=all|today|week|overdue|done
router.get('/', wrap(async (req, res) => {
  const filter = req.query.filter || 'all';
  const t = today();
  const where = ['user_id = ?'];
  const params = [req.userId];
  let order = "due_date ASC, FIELD(priority, 'high', 'medium', 'low'), id ASC";

  if (filter === 'done') {
    where.push("status = 'done'");
    order = 'completed_at DESC, id DESC';
  } else {
    where.push("status = 'pending'");
    if (filter === 'today') {
      where.push('due_date = ?');
      params.push(t);
    } else if (filter === 'week') {
      const monday = mondayOf(t);
      where.push('due_date BETWEEN ? AND ?');
      params.push(monday, addDays(monday, 6));
    } else if (filter === 'overdue') {
      where.push('due_date < ?');
      params.push(t);
    }
  }

  const [rows] = await db.query(
    `SELECT id, title, description, due_date, scope, priority, status, recurrence, completed_at
     FROM planned_tasks WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 500`,
    params
  );
  res.json({ planned: withOverdue(rows) });
}));

router.post('/', wrap(async (req, res) => {
  const title = cleanText(req.body.title, 200);
  if (!title) return res.status(400).json({ message: 'Title is required' });

  const scope = req.body.scope === 'week' ? 'week' : 'day';
  const recurrence = req.body.recurrence || 'none';
  if (!RECURRENCE[scope].includes(recurrence)) {
    return res.status(400).json({ message: 'That repeat option is not available for this type' });
  }

  let dueDate;
  if (scope === 'day') {
    dueDate = req.body.due_date;
    if (!isDate(dueDate)) return res.status(400).json({ message: 'A valid due date is required' });
  } else {
    const weekOf = req.body.week_of || today();
    if (!isDate(weekOf)) return res.status(400).json({ message: 'Invalid week' });
    dueDate = await weekEnd(req.userId, weekOf);
  }

  const [result] = await db.query(
    `INSERT INTO planned_tasks (user_id, title, description, due_date, scope, priority, recurrence)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.userId, title, cleanText(req.body.description, 5000) || null, dueDate, scope, priorityOr(req.body.priority), recurrence]
  );
  logEvent(req, 'planned_create');
  const [rows] = await db.query('SELECT * FROM planned_tasks WHERE id = ?', [result.insertId]);
  res.status(201).json({ planned: withOverdue(rows)[0] });
}));

router.put('/:id', wrap(async (req, res) => {
  const [found] = await db.query(
    "SELECT * FROM planned_tasks WHERE id = ? AND user_id = ? AND status = 'pending'",
    [req.params.id, req.userId]
  );
  const item = found[0];
  if (!item) return res.status(404).json({ message: 'Planned task not found' });

  const title = cleanText(req.body.title, 200);
  if (!title) return res.status(400).json({ message: 'Title is required' });
  const recurrence = req.body.recurrence || 'none';
  if (!RECURRENCE[item.scope].includes(recurrence)) {
    return res.status(400).json({ message: 'That repeat option is not available for this type' });
  }

  let dueDate = item.due_date;
  if (item.scope === 'day') {
    if (!isDate(req.body.due_date)) return res.status(400).json({ message: 'A valid due date is required' });
    dueDate = req.body.due_date;
  } else if (req.body.week_of) {
    if (!isDate(req.body.week_of)) return res.status(400).json({ message: 'Invalid week' });
    dueDate = await weekEnd(req.userId, req.body.week_of);
  }

  await db.query(
    `UPDATE planned_tasks SET title = ?, description = ?, due_date = ?, priority = ?, recurrence = ?
     WHERE id = ? AND user_id = ?`,
    [title, cleanText(req.body.description, 5000) || null, dueDate, priorityOr(req.body.priority), recurrence, item.id, req.userId]
  );
  logEvent(req, 'planned_update');
  const [rows] = await db.query('SELECT * FROM planned_tasks WHERE id = ?', [item.id]);
  res.json({ planned: withOverdue(rows)[0] });
}));

router.delete('/:id', wrap(async (req, res) => {
  const [result] = await db.query('DELETE FROM planned_tasks WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!result.affectedRows) return res.status(404).json({ message: 'Planned task not found' });
  logEvent(req, 'planned_delete');
  res.json({ message: 'Planned task deleted' });
}));

// Mark done: logs it as a completed task for the day and, if recurring, schedules the next one.
router.patch('/:id/complete', wrap(async (req, res) => {
  const taskDate = req.body.date && isDate(req.body.date) ? req.body.date : today();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [found] = await conn.query(
      'SELECT * FROM planned_tasks WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, req.userId]
    );
    const item = found[0];
    if (!item) {
      await conn.rollback();
      return res.status(404).json({ message: 'Planned task not found' });
    }
    if (item.status === 'done') {
      await conn.rollback();
      return res.status(400).json({ message: 'Already completed' });
    }

    const [ins] = await conn.query(
      `INSERT INTO tasks (user_id, title, description, task_date, priority, planned_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.userId, item.title, item.description, taskDate, item.priority, item.id]
    );
    await conn.query("UPDATE planned_tasks SET status = 'done', completed_at = ? WHERE id = ?", [nowStamp(), item.id]);

    let nextId = null;
    if (item.recurrence !== 'none') {
      const due = await nextDueDate(req.userId, item, conn);
      const [next] = await conn.query(
        `INSERT INTO planned_tasks (user_id, title, description, due_date, scope, priority, recurrence)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.userId, item.title, item.description, due, item.scope, item.priority, item.recurrence]
      );
      nextId = next.insertId;
    }
    await conn.commit();
    logEvent(req, 'planned_complete');
    res.json({ taskId: ins.insertId, nextPlannedId: nextId });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// Move one overdue item forward to the next working day (or end of this week for weekly items).
async function rescheduleItem(userId, item) {
  const t = today();
  const due = item.scope === 'week'
    ? await weekEnd(userId, t)
    : await nextWorkingDay(userId, t);
  await db.query('UPDATE planned_tasks SET due_date = ? WHERE id = ? AND user_id = ?', [due, item.id, userId]);
  return due;
}

router.patch('/:id/reschedule', wrap(async (req, res) => {
  const [found] = await db.query(
    "SELECT * FROM planned_tasks WHERE id = ? AND user_id = ? AND status = 'pending'",
    [req.params.id, req.userId]
  );
  if (!found[0]) return res.status(404).json({ message: 'Planned task not found' });
  const due = await rescheduleItem(req.userId, found[0]);
  logEvent(req, 'planned_reschedule');
  res.json({ due_date: due });
}));

router.post('/reschedule-overdue', wrap(async (req, res) => {
  const [rows] = await db.query(
    "SELECT * FROM planned_tasks WHERE user_id = ? AND status = 'pending' AND due_date < ?",
    [req.userId, today()]
  );
  for (const item of rows) await rescheduleItem(req.userId, item);
  if (rows.length) logEvent(req, 'planned_reschedule');
  res.json({ moved: rows.length });
}));

module.exports = router;
