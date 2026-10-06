const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const auth = require('../middleware/auth');
const wrap = require('../utils/wrap');
const { cleanText } = require('../utils/validate');

const router = express.Router();

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, theme: u.theme });

router.post('/register', wrap(async (req, res) => {
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
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    [name, email, hash]
  );
  const user = { id: result.insertId, name, email, theme: 'light' };
  res.status(201).json({ token: signToken(user.id), user });
}));

router.post('/login', wrap(async (req, res) => {
  const email = cleanText(req.body.email, 190).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: 'Incorrect email or password' });
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
}));

router.get('/me', auth, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT id, name, email, theme FROM users WHERE id = ?', [req.userId]);
  if (!rows.length) return res.status(401).json({ message: 'Account not found' });
  res.json({ user: rows[0] });
}));

router.patch('/theme', auth, wrap(async (req, res) => {
  const { theme } = req.body;
  if (!['light', 'dark'].includes(theme)) return res.status(400).json({ message: 'Invalid theme' });
  await db.query('UPDATE users SET theme = ? WHERE id = ?', [theme, req.userId]);
  res.json({ theme });
}));

module.exports = router;
