require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const auth = require('./middleware/auth');

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', auth, require('./routes/tasks'));
app.use('/api/planned', auth, require('./routes/planned'));
app.use('/api/stats', auth, require('./routes/stats'));
app.use('/api', auth, require('./routes/calendar'));

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

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
    console.error('Could not connect to MySQL. Is XAMPP MySQL running and the database imported?');
    console.error(err.message);
    process.exit(1);
  });
