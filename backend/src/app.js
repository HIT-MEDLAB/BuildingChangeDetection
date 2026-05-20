require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const inspectionRoutes = require('./routes/inspections');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// --- Middleware ---

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// --- Routes ---

// Health check — useful for monitoring and Docker health checks
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/inspections', inspectionRoutes);

// --- Error handling (must be last) ---
app.use(errorHandler);

module.exports = app;
