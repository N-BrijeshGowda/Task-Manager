const PRIORITIES = ['low', 'medium', 'high'];

const cleanText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const priorityOr = (v, fallback = 'medium') => (PRIORITIES.includes(v) ? v : fallback);

module.exports = { PRIORITIES, cleanText, priorityOr };
