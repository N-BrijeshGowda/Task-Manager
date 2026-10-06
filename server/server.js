require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const auth = require('./middleware/auth');
const { passwordChangeDone } = auth;
const requireAdmin = require('./middleware/requireAdmin');

const isProd = process.env.NODE_ENV === 'production';

// Refuse to start live with a missing or placeholder signing secret.
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /change|example/i.test(process.env.JWT_SECRET))) {
  console.error('JWT_SECRET must be set to a long random value (32+ characters) in production.');
  process.exit(1);
}

const app = express();

// Behind a hosting proxy (Render, nginx, ...) so req.ip is the real visitor, not the proxy.
app.set('trust proxy', isProd ? 1 : false);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    ...(isProd && { 'Strict-Transport-Security': 'max-age=15552000' }),
  });
  next();
});

// In production the site and API share one origin, so CORS is only needed for local development.
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', auth, passwordChangeDone, require('./routes/tasks'));
app.use('/api/planned', auth, passwordChangeDone, require('./routes/planned'));
app.use('/api/stats', auth, passwordChangeDone, require('./routes/stats'));
app.use('/api/admin', auth, passwordChangeDone, requireAdmin, require('./routes/admin'));
app.use('/api', auth, passwordChangeDone, require('./routes/calendar'));

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// Serve the built React app when it exists (production).
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server' });
});

const port = Number(process.env.PORT) || 5000;

db.query('SELECT 1')
  .then(() => {
    app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
  })
  .catch((err) => {
    console.error('Could not connect to MySQL. Is it running, and is the database imported?');
    console.error(err.message);
    process.exit(1);
  });
