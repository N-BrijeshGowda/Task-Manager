// Promote (or demote) an account:
//   node scripts/make-admin.js you@example.com          -> make admin
//   node scripts/make-admin.js you@example.com --remove -> back to a normal user
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../config/db');

(async () => {
  const email = (process.argv[2] || '').trim().toLowerCase();
  const remove = process.argv.includes('--remove');
  if (!email) {
    console.error('Usage: node scripts/make-admin.js <email> [--remove]');
    process.exit(1);
  }
  const [result] = await db.query('UPDATE users SET role = ? WHERE email = ?', [remove ? 'user' : 'admin', email]);
  if (!result.affectedRows) {
    console.error('No account found with that email. Register it on the website first.');
    process.exit(1);
  }
  console.log(`${email} is now ${remove ? 'a normal user' : 'an admin'}.`);
  process.exit(0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
