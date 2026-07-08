require('dotenv').config();
const { Pool } = require('pg');

// Database connection pool.
// The pool is created but does NOT connect on import — this way the server
// starts even if PostgreSQL isn't running yet.
// Connections are established lazily on the first query.

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME,
});

// TODO: Add error handling for unexpected pool disconnections
// pool.on('error', (err) => {
//   console.error('Unexpected database pool error:', err);
// });

module.exports = pool;
