// Creates the tables in a cloud MySQL database (Aiven, etc.).
//   1. Copy server/.env.cloud.example to server/.env.cloud and fill in your database details.
//   2. From the server folder run:  node scripts/setup-db.js
// It is safe to run more than once: existing tables and data are left alone.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.cloud') });
const mysql = require('mysql2/promise');

const REQUIRED = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = REQUIRED.filter((k) => process.env[k] === undefined);
if (missing.length) {
  console.error(`Missing in server/.env.cloud: ${missing.join(', ')}`);
  console.error('Copy server/.env.cloud.example to server/.env.cloud and fill it in.');
  process.exit(1);
}

let ssl;
if (process.env.DB_SSL_CA_FILE) {
  const caPath = path.resolve(process.env.DB_SSL_CA_FILE);
  if (!fs.existsSync(caPath)) {
    console.error(`Cannot find the CA certificate file: ${caPath}`);
    process.exit(1);
  }
  ssl = { ca: fs.readFileSync(caPath, 'utf8'), minVersion: 'TLSv1.2' };
} else if (process.env.DB_SSL === 'true') {
  ssl = { minVersion: 'TLSv1.2' };
}

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema_hosted.sql'), 'utf8');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
    ssl,
  });
  console.log(`Connected to ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

  await conn.query(sql);

  const [rows] = await conn.query('SHOW TABLES');
  const tables = rows.map((r) => Object.values(r)[0]);
  console.log('Tables now in the database:', tables.join(', '));
  const expected = ['activity_logs', 'day_settings', 'planned_tasks', 'tasks', 'users'];
  const absent = expected.filter((t) => !tables.includes(t));
  if (absent.length) {
    console.error(`Still missing: ${absent.join(', ')}`);
    process.exit(1);
  }
  console.log('Done. The database is ready.');
  await conn.end();
})().catch((err) => {
  console.error('\nSetup failed:', err.message);
  if (err.code === 'ENOTFOUND') console.error('Hint: DB_HOST looks wrong. Copy the host from the Aiven Overview page.');
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') console.error('Hint: check DB_HOST and DB_PORT (the port is not 3306), and that the Aiven service is Running.');
  if (err.code === 'ER_ACCESS_DENIED_ERROR') console.error('Hint: the user or password is wrong.');
  if (/certificate|self.signed|SSL/i.test(err.message)) console.error('Hint: set DB_SSL_CA_FILE to the full path of the ca.pem you downloaded from Aiven.');
  process.exit(1);
});
