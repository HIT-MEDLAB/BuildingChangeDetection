const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const pool = require('../config/db')
const logger = require('../config/logger');
const router = express.Router();


// POST /api/auth/login
// REQ-AUTH-01: "The system shall include a Login screen requiring a
// username and password." Login authenticates by username (database/
// 004_add_username.sql); email is still stored on the account for contact
// purposes but is no longer a login credential.
router.post('/login', async (req, res) => {
//   1. Validate request body (username, password)
  const { username, password } = req.body;

  if(!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' })
  }

  try{
//   2. Look up user in the database by username
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];


    if (!user) {
      logger.warn('Login failed: unknown username', { username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

//   3. Compare password with stored hash (use bcrypt)
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      logger.warn('Login failed: wrong password', { userId: user.id, username });
      return res.status(401).json({ error: 'Invalid credentials'});
    }

    // US-6: disabled accounts cannot log in, even with a correct password
    if (user.is_active === false) {
      logger.warn('Login blocked: account disabled', { userId: user.id, username });
      return res.status(403).json({ error: 'This account has been disabled' });
    }

    //   4. Generate a JWT token (use jsonwebtoken package)
    // role is embedded in the token so requireAdmin can check it without an
    // extra DB round-trip on every request. Tradeoff: revoking admin access
    // (or disabling a user) takes effect on next login, not immediately for
    // tokens already issued (tokens expire after 8h).
    const jwtSecret = process.env.JWT_SECRET;
    const token = jwt.sign(
      { userId: user.id, username: user.username, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '8h' }
    );

    logger.logUserAction('login', { userId: user.id, username });

//   5. Return the token and user info
    res.status(200).json({
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (err){
    logger.error('Login error', { message: err.message, stack: err.stack, username });
    res.status(500).json({ error: 'Internal server error' });
  }
});



// No self-registration endpoint by design. Per the PRD (section 3.2, US-6),
// access is admin-managed: an admin creates accounts via
// POST /api/admin/users (see routes/admin.js), not public sign-up. This is
// appropriate for a municipal tool with a fixed set of inspector/admin staff.

module.exports = router;
