const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const pool = require('../config/db')
const router = express.Router();


// POST /api/auth/login
router.post('/login', async (req, res) => {
//   1. Validate request body (email, password)
  const { email, password } = req.body;

  if(!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try{
//   2. Look up user in the database by email
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    console.log('Query result for email:', email, 'Found user:', user);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

//   3. Compare password with stored hash (use bcrypt)
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials '});
    }

    //   4. Generate a JWT token (use jsonwebtoken package)
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_for_development';
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      jwtSecret,
      { expiresIn: '8h' }
    );

//   5. Return the token and user info
    res.status(200).json({
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });

  } catch (err){
    console.error('Login error:',err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// TODO: Decide if you need a registration endpoint
// router.post('/register', (req, res) => { ... });

module.exports = router;
