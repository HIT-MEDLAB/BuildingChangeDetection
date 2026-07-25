// Authorization middleware for admin-only endpoints.
// Must run AFTER `authenticate` — it relies on req.user being set from the
// verified JWT (see middleware/authenticate.js).

function requireAdmin(req, res, next) {
  if (!req.user) {
    // Defensive check: this middleware is misconfigured if it runs before authenticate
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

module.exports = requireAdmin;
