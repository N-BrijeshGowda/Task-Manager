// Date helpers using local 'YYYY-MM-DD' strings (the same format the API uses).
const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayISO = () => toISO(new Date());

export const monthKey = (year, month) => `${year}-${pad(month + 1)}`;

export const formatDate = (s) =>
  fromISO(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export const formatLong = (s) =>
  fromISO(s).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const isSaturday = (s) => fromISO(s).getDay() === 6;
