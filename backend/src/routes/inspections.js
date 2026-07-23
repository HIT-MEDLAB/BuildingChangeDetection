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
const archiver = require('archiver');
const logger = require('../config/logger');

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

// NFR-PERF-01: the PRD requires a response within 8s end-to-end. Give the ML
// call a hard budget well under that so a hung/slow model fails fast into the
// `failed` path instead of hanging the whole request (and the client) with it.
// Configurable via env (e.g. lowering it in tests) without a code change.
const ML_TIMEOUT_MS = parseInt(process.env.ML_TIMEOUT_MS, 10) || 5000;

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
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

      let mlResponse;
      try {
        mlResponse = await fetch(`${mlServiceUrl}/predict`, {
          method: 'POST',
          body: form,
          headers: form.getHeaders(),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutHandle);
      }

      if (!mlResponse.ok) {
        // The ML service (FastAPI) returns structured errors as { detail: "..." }
        // for cases like corrupt images or mismatched camera angles (REQ-CORE-06).
        // Surface that specific message to the client instead of a generic one.
        let detail;
        try {
          const errBody = await mlResponse.json();
          detail = errBody?.detail;
        } catch {
          // response wasn't JSON - fall through with no detail
        }
        const err = new Error(detail || `ML service responded with status ${mlResponse.status}`);
        err.clientMessage = detail ? `Comparison failed - ${detail.replace(/^comparison failed - /i, '')}` : undefined;
        throw err;
      }

      mlResult = await mlResponse.json();

      // REQ-CORE-06 / NFR-REL-01: the model can be "up" and still return
      // something we can't use (wrong shape, missing fields) - treat that the
      // same as a failure rather than letting a malformed result reach the DB.
      if (typeof mlResult?.changes_detected !== 'boolean' || !Array.isArray(mlResult?.bounding_boxes)) {
        throw new Error('ML service returned an unexpected response shape');
      }

    } catch (mlErr) {
      // ML call failed (down, timed out, or bad response) - mark inspection
      // as failed and return a clear error instead of hanging or crashing.
      const isTimeout = mlErr.name === 'AbortError';
      const message = isTimeout
        ? `ML service timed out after ${ML_TIMEOUT_MS}ms`
        : mlErr.message;
      logger.error('ML service error', { message, inspectionId, userId: req.user.userId });
      await pool.query(
        `UPDATE inspections SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [inspectionId]
      );
      // Clean up saved image files if ML processing failed
      fs.unlink(imageBeforePath, () => {});
      fs.unlink(imageAfterPath, () => {});
      // REQ-CORE-06: a clear, plain-language message instead of a raw error/crash.
      // Prefer the ML service's specific reason (e.g. corrupt file, mismatched
      // angles) when we have one; otherwise fall back to a generic message.
      const clientMessage = isTimeout
        ? 'Comparison failed - the analysis took too long. Please try again.'
        : (mlErr.clientMessage || 'Comparison failed - the images could not be compared. Please try different images.');

      return res.status(502).json({
        error: clientMessage,
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

    logger.logUserAction('upload', { userId: req.user.userId, inspectionId });

    res.status(201).json({
      inspectionId,
      status: 'completed',
      message: 'Images uploaded. Processing will begin shortly.'
    });

  } catch (err) {
    logger.error('Upload error', { message: err.message, stack: err.stack, userId: req.user.userId });
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
      `SELECT i.id, i.status, i.case_status, i.created_at, i.notes,
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
    logger.error('Get inspections error', { message: err.message, stack: err.stack, userId: req.user.userId });
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
    caseStatus: inspection.case_status,
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
    logger.error('Get inspection error', { message: err.message, stack: err.stack, userId: req.user.userId });
    res.status(500).json({ error: 'Internal server error' });
  }
});
    
// GET /api/inspections/:id/export
// US-5: export an inspection's images and case record as a single zip,
// for handoff to legal/enforcement. Same ownership rule as the PDF report.
router.get('/:id/export', async (req, res) => {
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

    if (!fs.existsSync(inspection.image_before_path) || !fs.existsSync(inspection.image_after_path)) {
      return res.status(500).json({ error: 'Source images are missing on the server' });
    }

    const resultsQuery = await pool.query(
      `SELECT changes_detected, result_data FROM inspection_results WHERE inspection_id = $1`,
      [id]
    );
    const results = resultsQuery.rows[0];

    const record = {
      id: inspection.id,
      buildingId: inspection.building_id,
      status: inspection.status,
      caseStatus: inspection.case_status,
      notes: inspection.notes,
      createdAt: inspection.created_at,
      results: results ? {
        changesDetected: results.changes_detected,
        boundingBoxes: results.result_data?.bounding_boxes || []
      } : null
    };

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="inspection-${inspection.id}-export.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      logger.error('Export archive error', { message: err.message, inspectionId: id, userId: req.user.userId });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    archive.pipe(res);
    archive.append(JSON.stringify(record, null, 2), { name: 'record.json' });
    archive.file(inspection.image_before_path, { name: `before${path.extname(inspection.image_before_path)}` });
    archive.file(inspection.image_after_path, { name: `after${path.extname(inspection.image_after_path)}` });

    logger.logUserAction('export', { userId: req.user.userId, inspectionId: id });

    await archive.finalize();

  } catch (err) {
    logger.error('Export inspection error', { message: err.message, stack: err.stack, userId: req.user.userId });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

const VALID_CASE_STATUSES = ['under_review', 'confirmed', 'dismissed'];

// PATCH /api/inspections/:id/status
// US-4: inspector classifies a case outcome and can attach a short note.
// Distinct from `status` (ML processing state) — this is the inspector's
// enforcement decision.
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { caseStatus, note } = req.body;

  if (!caseStatus || !VALID_CASE_STATUSES.includes(caseStatus)) {
    return res.status(400).json({
      error: `caseStatus must be one of: ${VALID_CASE_STATUSES.join(', ')}`
    });
  }

  try {
    const inspectionResult = await pool.query(
      `SELECT id, user_id FROM inspections WHERE id = $1`,
      [id]
    );

    const inspection = inspectionResult.rows[0];

    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    if (inspection.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await pool.query(
      `UPDATE inspections
       SET case_status = $1, notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3
       RETURNING id, case_status, notes, updated_at`,
      [caseStatus, note ?? null, id]
    );

    const updated = result.rows[0];

    logger.logUserAction('status_change', {
      userId: req.user.userId, inspectionId: id, caseStatus: updated.case_status
    });

    res.status(200).json({
      id: updated.id,
      caseStatus: updated.case_status,
      notes: updated.notes,
      updatedAt: updated.updated_at
    });

  } catch (err) {
    logger.error('Update case status error', { message: err.message, stack: err.stack, userId: req.user.userId });
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

    logger.logUserAction('delete_inspection', { userId: req.user.userId, inspectionId: id });

    res.status(200).json({ message: 'Inspection deleted successfully' });

  } catch (err) {
    logger.error('Delete inspection error', { message: err.message, stack: err.stack, userId: req.user.userId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
