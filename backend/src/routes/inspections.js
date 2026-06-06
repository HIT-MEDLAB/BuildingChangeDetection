const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const authenticate = require('../middleware/authenticate');
const pool = require('../config/db');
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');


router.use(authenticate);

// --- Multer configuration ---

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/tiff'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true); 
  } else{
    cb(new Error ('Invalid file type. Only JPEG, PNG and TIFT are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } //10MB
});

// POST /api/inspections/upload
router.post('/upload', upload.fields([
  { name: 'image_before', maxCount: 1 },
  { name: 'image_after', maxCount: 1 }
]), async (req, res) => {
  if (!req.files?.image_before || !req.files?.image_after) {
    return res.status(400).json({ error: 'Both image_before and image_after are required' });
  }

  const imageBeforePath = req.files.image_before[0].path;
  const imageAfterPath = req.files.image_after[0].path;

  try{
    const result = await pool.query(
      `INSERT INTO inspections (user_id, status, image_before_path, image_after_path)
      VALUES ($1, 'pending', $2, $3)
      RETURNING id`,
      [req.user.userId, imageBeforePath, imageAfterPath]
    );

    const inspectionId = result.rows[0].id;

    const form = new FormData();
    form.append('image_before', fs.createReadStream(imageBeforePath));
    form.append('image_after', fs.createReadStream(imageAfterPath));

    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    const mlResponse = await fetch(`${mlServiceUrl}/predict`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const mlResult = await mlResponse.json();

    await pool.query(
    `INSERT INTO inspection_results (inspection_id, changes_detected, result_data)
    VALUES ($1, $2, $3)`,
    [inspectionId, mlResult.changes_detected, JSON.stringify(mlResult)]
    );

    await pool.query(
    `UPDATE inspections SET status = 'completed', updated_at = NOW()
    WHERE id = $1`,
    [inspectionId]
    );
    

    res.status(201).json({
    message: 'Images uploaded successfully',
    inspection_id: inspectionId,
    status: 'completed',
    ml_result: mlResult
  });

  }catch (err){
    console.error('Upload error: ', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// GET /api/inspections/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const inspectionResult = await pool.query(
      `SELECT * FROM inspections WHERE id = $1`,
      [id]
    );

    const inspection = inspectionResult.rows[0];

    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    if (inspection.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let results = null;
    if (inspection.status === 'completed') {
      const resultsQuery = await pool.query(
        `SELECT * FROM inspection_results WHERE inspection_id = $1`,
        [id]
      );
      results = resultsQuery.rows[0] || null;
    }

    res.status(200).json({
      inspection,
      results
    });

  } catch (err) {
    console.error('Get inspection error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
    
// GET /api/inspections/history
router.get('/', (req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    hint: 'Implement inspection history with pagination — see docs/api-spec.md',
  });
});

// TODO: Implement paginated inspection history
// Steps:
//   1. Parse query params (page, limit, filters)
//   2. Query the database with pagination (LIMIT/OFFSET)
//   3. Return the list with pagination metadata


module.exports = router;
