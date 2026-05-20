// TODO: Implement JWT verification middleware
//
// This middleware should:
//   1. Read the Authorization header: "Bearer <token>"
//   2. Verify the JWT using jsonwebtoken.verify() and JWT_SECRET from env
//   3. Attach the decoded user info to req.user
//   4. Call next() if valid, or return 401 if invalid/missing
//
// Usage in routes:
//   const authenticate = require('../middleware/authenticate');
//   router.use(authenticate);  // protect all routes in this router
//   — or —
//   router.get('/secret', authenticate, handler);  // protect a single route

function authenticate(req, res, next) {
  // Remove this stub and implement real JWT verification
  res.status(401).json({ error: 'Authentication not yet implemented' });
}

module.exports = authenticate;
