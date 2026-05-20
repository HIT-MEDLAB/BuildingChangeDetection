const express = require('express');
const router = express.Router();

// POST /api/auth/login
// TODO: Implement JWT authentication
// Steps:
//   1. Validate request body (email, password)
//   2. Look up user in the database by email
//   3. Compare password with stored hash (use bcrypt)
//   4. Generate a JWT token (use jsonwebtoken package)
//   5. Return the token and user info
//
// Packages you'll need to install:
//   npm install bcrypt jsonwebtoken
//
// See docs/api-spec.md for request/response format
router.post('/login', (req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    hint: 'Implement JWT login — see the TODO comments in this file',
  });
});

// TODO: Decide if you need a registration endpoint
// router.post('/register', (req, res) => { ... });

module.exports = router;
