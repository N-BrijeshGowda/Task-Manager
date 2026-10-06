const express = require('express');
const db = require('../config/db');
const wrap = require('../utils/wrap');
const { today, addDays, mondayOf } = require('../utils/dates');
const { getSettings, isWorking } = require('../utils/workdays');

const router = express.Router();

// Streak = consecutive days with at least one completed task. Holidays, leave, Sundays and
// non-working Saturdays never break it, and today not being done yet does not break it either.
router.get('/', wrap(async (req, res) => {
  const t = today();
  const [dateRows] = await db.query(
    'SELECT DISTINCT task_date AS date FROM tasks WHERE user_id = ? AND task_date <= ?',
    [req.userId, t]
  );
  const done = new Set(dateRows.map((r) => r.date));

  let streak = 0;
  if (done.size) {
    const earliest = [...done].sort()[0];
    const settings = await getSettings(req.userId, earliest, t);
    let d = done.has(t) ? t : addDays(t, -1);
    while (d >= earliest) {
      if (done.has(d)) streak++;
      else if (isWorking(d, settings)) break;
      d = addDays(d, -1);
    }
  }

  const monday = mondayOf(t);
  const [[week]] = await db.query(
    'SELECT COUNT(*) AS n FROM tasks WHERE user_id = ? AND task_date BETWEEN ? AND ?',
    [req.userId, monday, addDays(monday, 6)]
  );
  const [[todayRow]] = await db.query(
    'SELECT COUNT(*) AS n FROM tasks WHERE user_id = ? AND task_date = ?',
    [req.userId, t]
  );
  const [[overdue]] = await db.query(
    "SELECT COUNT(*) AS n FROM planned_tasks WHERE user_id = ? AND status = 'pending' AND due_date < ?",
    [req.userId, t]
  );

  res.json({ streak, doneToday: todayRow.n, doneThisWeek: week.n, overdue: overdue.n });
}));

module.exports = router;
