require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'daily_task_tracker',
  waitForConnections: true,
  connectionLimit: 10,
  // Return DATE columns as 'YYYY-MM-DD' strings so there are no timezone surprises.
  dateStrings: true,
  // Cloud MySQL providers require TLS. Set DB_SSL=true there (leave it off for local XAMPP).
  ...(process.env.DB_SSL === 'true' && {
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: process.env.DB_SSL_STRICT !== 'false' },
  }),
});

module.exports = pool;
