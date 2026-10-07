// Promote (or demote) an account:
//   npm run make-admin -- you@example.com                 -> admin on your LOCAL database (server/.env)
//   npm run make-admin -- --cloud you@example.com         -> admin on your LIVE cloud database (server/.env.cloud)
//   add --remove to turn an admin back into a normal user
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const cloud = args.includes('--cloud');
const remove = args.includes('--remove');
const email = (args.find((a) => !a.startsWith('--')) || '').trim().toLowerCase();

if (!email) {
  console.error('Usage: npm run make-admin -- [--cloud] [--remove] <email>');
  process.exit(1);
}

if (cloud) {
  // Same settings file the setup-db script uses. Loaded before the database module.
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.cloud') });
  if (!process.env.DB_HOST) {
    console.error('server/.env.cloud not found or empty. Copy server/.env.cloud.example to server/.env.cloud and fill it in.');
    process.exit(1);
  }
  process.env.DB_SSL = 'true';
  if (process.env.DB_SSL_CA_FILE) {
    const caPath = path.resolve(process.env.DB_SSL_CA_FILE);
    if (!fs.existsSync(caPath)) {
      console.error(`Cannot find the CA certificate file: ${caPath}`);
      process.exit(1);
    }
    process.env.DB_SSL_CA = fs.readFileSync(caPath, 'utf8');
  }
} else {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

const db = require('../config/db');

(async () => {
  console.log(`Database: ${cloud ? 'LIVE (cloud)' : 'local'}`);
  const [result] = await db.query('UPDATE users SET role = ? WHERE email = ?', [remove ? 'user' : 'admin', email]);
  if (!result.affectedRows) {
    console.error('No account found with that email in this database. Check the spelling, and that you registered on this site.');
    process.exit(1);
  }
  console.log(`${email} is now ${remove ? 'a normal user' : 'an admin'}.`);
  process.exit(0);
})().catch((err) => {
  console.error(err.message || err.code);
  if (err.code === 'ER_ACCESS_DENIED_ERROR') console.error('Hint: wrong user or password in the env file.');
  process.exit(1);
});
