// Must run after the auth middleware.
module.exports = function requireAdmin(req, res, next) {
  if (req.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  next();
};
