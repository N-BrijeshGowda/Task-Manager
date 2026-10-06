// Date helpers that work on 'YYYY-MM-DD' strings (UTC maths, so no DST/timezone drift).
const pad = (n) => String(n).padStart(2, '0');

const fmt = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fmt(parse(s)) === s;

const addDays = (s, n) => {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
};

// 0 = Sunday ... 6 = Saturday
const dayOfWeek = (s) => parse(s).getUTCDay();

const today = () => {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
};

// Local date and time as 'YYYY-MM-DD HH:MM:SS'
const nowStamp = () => {
  const n = new Date();
  return `${today()} ${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
};

// Monday of the week (Mon-Sun) that contains the date
const mondayOf = (s) => {
  const dow = dayOfWeek(s);
  return addDays(s, dow === 0 ? -6 : 1 - dow);
};

const monthRange = (month) => {
  const [y, m] = month.split('-').map(Number);
  const from = `${y}-${pad(m)}-01`;
  const to = fmt(new Date(Date.UTC(y, m, 0)));
  return { from, to };
};

module.exports = { isDate, addDays, dayOfWeek, today, nowStamp, mondayOf, monthRange };
