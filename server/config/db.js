require('dotenv').config();
const mysql = require('mysql2/promise');

// Values pasted into a hosting dashboard often carry a stray leading/trailing space or newline.
const env = (key, fallback = '') => (process.env[key] ?? '').trim() || fallback;

const pool = mysql.createPool({
  host: env('DB_HOST', 'localhost'),
  port: Number(env('DB_PORT')) || 3306,
  user: env('DB_USER', 'root'),
  password: env('DB_PASSWORD'),
  database: env('DB_NAME', 'daily_task_tracker'),
  waitForConnections: true,
  connectionLimit: 10,
  // Return DATE columns as 'YYYY-MM-DD' strings so there are no timezone surprises.
  dateStrings: true,
  // Cloud MySQL providers require TLS. Set DB_SSL=true there (leave it off for local XAMPP).
  ...(env('DB_SSL') === 'true' && {
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: env('DB_SSL_STRICT') !== 'false',
      // Providers like Aiven sign with their own CA: paste its PEM text into DB_SSL_CA.
      // (Dashboards often turn real newlines into the two characters \n, so convert them back.)
      ...(process.env.DB_SSL_CA && { ca: process.env.DB_SSL_CA.trim().replace(/\\n/g, '\n') }),
    },
  }),
});

module.exports = pool;
