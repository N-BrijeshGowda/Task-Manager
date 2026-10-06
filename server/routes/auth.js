const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const auth = require('../middleware/auth');
const { passwordChangeDone } = auth;
const rateLimit = require('../middleware/rateLimit');
const wrap = require('../utils/wrap');
const { logEvent } = require('../utils/audit');
const { cleanText } = require('../utils/validate');

const router = express.Router();

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});
const registerLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many sign-ups from this network. Please try again later.',
});

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, theme: u.theme, role: u.role,
  must_change_password: !!u.must_change_password,
});

router.post('/register', registerLimit, wrap(async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const email = cleanText(req.body.email, 190).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!name) return res.status(400).json({ message: 'Name is required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

  const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) return res.status(409).json({ message: 'That email is already registered' });

  const hash = await bcrypt.hash(password, 10);
  const [result] = await db.query(
    'INSERT INTO users (name, email, password_hash, last_login_at) VALUES (?, ?, ?, NOW())',
    [name, email, hash]
  );
  const user = { id: result.insertId, name, email, theme: 'light', role: 'user', must_change_password: false };
  logEvent(req, 'register', { userId: user.id });
  res.status(201).json({ token: signToken(user.id), user });
}));

router.post('/login', loginLimit, wrap(async (req, res) => {
  const email = cleanText(req.body.email, 190).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    // The attempted email is deliberately not logged, only the account id if one matched.
    logEvent(req, 'login_failed', { userId: user ? user.id : null });
    return res.status(401).json({ message: 'Incorrect email or password' });
  }
  if (!user.is_active) {
    logEvent(req, 'login_blocked', { userId: user.id });
    return res.status(403).json({ code: 'disabled', message: 'This account has been disabled' });
  }

  await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  logEvent(req, 'login', { userId: user.id });
  res.json({ token: signToken(user.id), user: publicUser(user) });
}));

router.get('/me', auth, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT id, name, email, theme, role, must_change_password FROM users WHERE id = ?', [req.userId]);
  if (!rows.length) return res.status(401).json({ message: 'Account not found' });
  res.json({ user: publicUser(rows[0]) });
}));

router.patch('/theme', auth, passwordChangeDone, wrap(async (req, res) => {
  const { theme } = req.body;
  if (!['light', 'dark'].includes(theme)) return res.status(400).json({ message: 'Invalid theme' });
  await db.query('UPDATE users SET theme = ? WHERE id = ?', [theme, req.userId]);
  res.json({ theme });
}));

// Used after an admin reset (the user must replace the temporary password) and any time later.
router.post('/change-password', auth, loginLimit, wrap(async (req, res) => {
  const current = typeof req.body.current_password === 'string' ? req.body.current_password : '';
  const next = typeof req.body.new_password === 'string' ? req.body.new_password : '';
  if (next.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });

  const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.userId]);
  if (!rows[0] || !(await bcrypt.compare(current, rows[0].password_hash))) {
    return res.status(400).json({ message: 'Your current (temporary) password is incorrect' });
  }
  if (current === next) return res.status(400).json({ message: 'Choose a password different from the current one' });

  await db.query('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [await bcrypt.hash(next, 10), req.userId]);
  logEvent(req, 'password_changed');
  res.json({ message: 'Password updated' });
}));

module.exports = router;
