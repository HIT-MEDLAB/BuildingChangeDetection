const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');
const pool = require('../config/db');
const logger = require('../config/logger');

const VALID_ROLES = ['inspector', 'admin'];

// US-6: only admins may reach any endpoint below
router.use(authenticate, requireAdmin);

// GET /api/admin/users
// List all users so an admin can review/manage access.
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, role, is_active, created_at
       FROM users
       ORDER BY created_at DESC`
    );

    res.status(200).json({
      users: result.rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.is_active,
        createdAt: u.created_at
      }))
    });
  } catch (err) {
    logger.error('List users error', { message: err.message, stack: err.stack, adminId: req.user.userId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users
// Create a new user account (inspector or admin).
router.post('/users', async (req, res) => {
  const { email, password, name, role = 'inspector' } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password and name are required' });
  }

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, is_active, created_at`,
      [email, passwordHash, name, role]
    );

    const user = result.rows[0];

    logger.logUserAction('admin_create_user', {
      adminId: req.user.userId, createdUserId: user.id, role: user.role
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at
    });
  } catch (err) {
    if (err.code === '23505') {
      // unique_violation on users.email
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    logger.error('Create user error', { message: err.message, stack: err.stack, adminId: req.user.userId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/users/:id
// Enable/disable a user and/or change their role.
router.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { role, isActive } = req.body;

  if (role === undefined && isActive === undefined) {
    return res.status(400).json({ error: 'Provide role and/or isActive to update' });
  }

  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
  }

  // Guard against an admin locking themselves out
  if (Number(id) === req.user.userId) {
    if (isActive === false) {
      return res.status(400).json({ error: 'You cannot disable your own account' });
    }
    if (role === 'inspector') {
      return res.status(400).json({ error: 'You cannot demote your own account' });
    }
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (role !== undefined) {
      fields.push(`role = $${i++}`);
      values.push(role);
    }
    if (isActive !== undefined) {
      fields.push(`is_active = $${i++}`);
      values.push(isActive);
    }
    values.push(id);

    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, email, name, role, is_active, created_at`,
      values
    );

    const user = result.rows[0];

    logger.logUserAction('admin_update_user', {
      adminId: req.user.userId, targetUserId: user.id, role: user.role, isActive: user.is_active
    });

    res.status(200).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at
    });
  } catch (err) {
    logger.error('Update user error', { message: err.message, stack: err.stack, adminId: req.user.userId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
