// Working-day logic: Sundays are always off, Saturdays are off unless the user marked
// them as a working Saturday, and holidays / leave days are off.
const db = require('../config/db');
const { addDays, dayOfWeek, mondayOf } = require('./dates');

async function getSettings(userId, from, to, conn = db) {
  const [rows] = await conn.query(
    'SELECT date, type, note FROM day_settings WHERE user_id = ? AND date BETWEEN ? AND ?',
    [userId, from, to]
  );
  const map = new Map();
  rows.forEach((r) => map.set(r.date, { type: r.type, note: r.note }));
  return map;
}

function isWorking(date, settings) {
  const type = settings.get(date)?.type;
  if (type === 'holiday' || type === 'leave') return false;
  const dow = dayOfWeek(date);
  if (dow === 0) return false;
  if (dow === 6) return type === 'working_saturday';
  return true;
}

// First working day on or after `from`.
async function nextWorkingDay(userId, from, conn = db) {
  const settings = await getSettings(userId, from, addDays(from, 120), conn);
  let d = from;
  for (let i = 0; i < 120; i++) {
    if (isWorking(d, settings)) return d;
    d = addDays(d, 1);
  }
  return from;
}

// Due date for a "this week" item: Saturday if it is a working Saturday, otherwise Friday.
// If that day is a holiday / leave, step back to the previous working day.
// With `shift`, a week-end that is already before `ref` rolls over to the next week.
async function weekEnd(userId, ref, { shift = true } = {}, conn = db) {
  let monday = mondayOf(ref);
  for (let i = 0; i < 8; i++) {
    const settings = await getSettings(userId, monday, addDays(monday, 6), conn);
    const sat = addDays(monday, 5);
    const fri = addDays(monday, 4);
    let c = settings.get(sat)?.type === 'working_saturday' ? sat : fri;
    while (c > monday && !isWorking(c, settings)) c = addDays(c, -1);
    if (!shift || c >= ref) return c;
    monday = addDays(monday, 7);
  }
  return addDays(mondayOf(ref), 4);
}

// Re-compute the due date of pending weekly items for the week containing `date`
// (called after a day marker changes).
async function readjustWeekly(userId, date, conn = db) {
  const monday = mondayOf(date);
  const sunday = addDays(monday, 6);
  const [rows] = await conn.query(
    `SELECT id FROM planned_tasks
     WHERE user_id = ? AND scope = 'week' AND status = 'pending' AND due_date BETWEEN ? AND ?`,
    [userId, monday, sunday]
  );
  if (!rows.length) return;
  const end = await weekEnd(userId, monday, { shift: false }, conn);
  await conn.query('UPDATE planned_tasks SET due_date = ? WHERE id IN (?)', [end, rows.map((r) => r.id)]);
}

module.exports = { getSettings, isWorking, nextWorkingDay, weekEnd, readjustWeekly };
