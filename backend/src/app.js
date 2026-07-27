require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const inspectionRoutes = require('./routes/inspections');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/report');
const errorHandler = require('./middleware/errorHandler');
const path = require('path');

const app = express();

// --- Middleware ---

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// US-2/REQ-CORE-04/05: serve uploaded + processed images so the frontend can
// actually display image_before_path/image_after_path/processed_image_path
// (previously nothing served /uploads at all - the paths were being returned
// by the API but were not reachable by the client). Protection here is by
// UUID filename (NFR-SEC-01), not per-request auth - consistent with <img>
// tags not being able to send an Authorization header.
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Routes ---

// Health check — useful for monitoring and Docker health checks
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/report', reportRoutes);

// --- Error handling (must be last) ---
app.use(errorHandler);

module.exports = app;
