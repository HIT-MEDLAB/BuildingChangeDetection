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

//Ensure uploads directory exists on startup
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}


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
    cb(new Error('Invalid file type. Only JPEG, PNG and TIFF are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } //10MB
});

// POST /api/inspections/upload
router.post('/upload', (req, res, next) => {
  upload.fields([
    { name: 'imageBefore', maxCount: 1 },
    { name: 'imageAfter', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  if (!req.files?.imageBefore || !req.files?.imageAfter) {
    return res.status(400).json({ error: 'Both images are required' });
  }

  const imageBeforePath = req.files.imageBefore[0].path;
  const imageAfterPath = req.files.imageAfter[0].path;

  try {
    // 1. Create inspection record with status pending
    const result = await pool.query(
      `INSERT INTO inspections (user_id, status, image_before_path, image_after_path)
      VALUES ($1, 'pending', $2, $3)
      RETURNING id`,
      [req.user.userId, imageBeforePath, imageAfterPath]
    );

    const inspectionId = result.rows[0].id;

    // 2. Send images to ML service
    let mlResult;
    try {
      const form = new FormData();
      form.append('image_before', fs.createReadStream(imageBeforePath));
      form.append('image_after', fs.createReadStream(imageAfterPath));

      const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
      const mlResponse = await fetch(`${mlServiceUrl}/predict`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
      });

      if (!mlResponse.ok) {
        throw new Error(`ML service responded with status ${mlResponse.status}`);
      }

      mlResult = await mlResponse.json();

    } catch (mlErr) {
      // ML call failed - mark inspection as failed and return clear error
      console.error('ML service error:', mlErr.message);
      await pool.query(
        `UPDATE inspections SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [inspectionId]
      );
      // Clean up saved image files if ML processing failed
      fs.unlink(imageBeforePath, () => {});
      fs.unlink(imageAfterPath, () => {});
      return res.status(502).json({
        error: 'ML service unavailable. Inspection marked as failed.',
        inspectionId
      });
    }

    // 3. Save ML results and mark completed
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
      inspectionId,
      status: 'completed',
      message: 'Images uploaded. Processing will begin shortly.'
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/inspections
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const inspectionsResult = await pool.query(
      `SELECT i.id, i.status, i.created_at, i.notes,
          i.image_before_path, i.image_after_path,
          r.changes_detected
      FROM inspections i
      LEFT JOIN inspection_results r ON r.inspection_id = i.id
      WHERE i.user_id = $1
      ORDER BY i.created_at DESC
      LIMIT $2 OFFSET $3`,
      [req.user.userId, limit, offset]
  );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM inspections WHERE user_id = $1`,
      [req.user.userId]
    );

    const total = parseInt(countResult.rows[0].count);

    res.status(200).json({
      inspections: inspectionsResult.rows,
      pagination: {
        page,
        limit,
        total
      }
    });

  } catch (err) {
    console.error('Get inspections error:', err);
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
    id: inspection.id,
    status: inspection.status,
    createdAt: inspection.created_at,
    notes: inspection.notes,
    images: {
      before: inspection.image_before_path,
      after: inspection.image_after_path
    },
    results: results ? {
      changesDetected: results.changes_detected,
      boundingBoxes: results.result_data.bounding_boxes
  } : null
});

  } catch (err) {
    console.error('Get inspection error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
    
// DELETE /api/inspections/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const inspectionResult = await pool.query(
      `SELECT * FROM inspections WHERE id = $1`,
      [id]
    );

    const inspection = inspectionResult.rows[0];

    // Check inspection exists
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    // Check ownership - only the owner can delete
    if (inspection.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Delete inspection - results cascade automatically (ON DELETE CASCADE)
    await pool.query(`DELETE FROM inspections WHERE id = $1`, [id]);

    res.status(200).json({ message: 'Inspection deleted successfully' });

  } catch (err) {
    console.error('Delete inspection error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
