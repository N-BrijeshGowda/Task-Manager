const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Verifies the token and re-checks the account in the database on every request, so a
// disabled or deleted user is locked out immediately instead of when the token expires.
async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Not authenticated' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Session expired, please log in again' });
  }

  try {
    const [rows] = await db.query('SELECT role, is_active, must_change_password FROM users WHERE id = ?', [payload.id]);
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Account not found' });
    if (!user.is_active) return res.status(403).json({ code: 'disabled', message: 'This account has been disabled' });
    req.userId = payload.id;
    req.role = user.role;
    req.mustChangePassword = !!user.must_change_password;
    next();
  } catch (err) {
    next(err);
  }
}

// After an admin sets a temporary password, the user may only change their password
// until they have done so. Use this on every route except /auth/me and /auth/change-password.
function passwordChangeDone(req, res, next) {
  if (req.mustChangePassword) {
    return res.status(403).json({ code: 'must_change_password', message: 'Please set a new password first' });
  }
  next();
}

module.exports = auth;
module.exports.passwordChangeDone = passwordChangeDone;
