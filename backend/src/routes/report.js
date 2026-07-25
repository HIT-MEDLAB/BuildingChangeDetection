const express = require('express');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const router = express.Router();
const authenticate = require('../middleware/authenticate');
const pool = require('../config/db');
const logger = require('../config/logger');

router.use(authenticate);

// GET /api/report/:id
// REQ-REP-01/REQ-REP-02: server-side PDF report for a single inspection.
// NFR-SEC-02: only the user who created the report (i.e. owns the
// inspection) may download it.
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const inspectionResult = await pool.query(
      `SELECT i.id, i.user_id, i.building_id, i.status, i.case_status,
              i.notes, i.created_at, i.image_before_path, i.image_after_path,
              u.name AS user_name, u.email AS user_email
       FROM inspections i
       JOIN users u ON u.id = i.user_id
       WHERE i.id = $1`,
      [id]
    );

    const inspection = inspectionResult.rows[0];

    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    // NFR-SEC-02: report download restricted to the inspection's owner
    if (inspection.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (inspection.status !== 'completed') {
      return res.status(409).json({
        error: `Report unavailable — inspection status is '${inspection.status}', not 'completed'`
      });
    }

    const resultsQuery = await pool.query(
      `SELECT changes_detected, result_data FROM inspection_results WHERE inspection_id = $1`,
      [id]
    );
    const results = resultsQuery.rows[0];
    const boundingBoxes = results?.result_data?.bounding_boxes || [];

    if (!fs.existsSync(inspection.image_before_path) || !fs.existsSync(inspection.image_after_path)) {
      return res.status(500).json({ error: 'Source images are missing on the server' });
    }

    // --- Build the PDF ---
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="inspection-${inspection.id}-report.pdf"`
    );

    doc.pipe(res);

    // Header / user details
    doc.fontSize(20).text('Building Inspection Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Reference: #${inspection.id}${inspection.building_id ? ' — ' + inspection.building_id : ''}`);
    doc.text(`Inspector: ${inspection.user_name} (${inspection.user_email})`);
    doc.text(`Date: ${new Date(inspection.created_at).toISOString()}`);
    doc.text(`Case status: ${inspection.case_status}`);
    if (inspection.notes) {
      doc.text(`Notes: ${inspection.notes}`);
    }
    doc.moveDown();

    // Thumbnails: reference ("before") and current ("after") images
    const thumbWidth = 220;
    const thumbY = doc.y;

    doc.fontSize(12).text('Reference Image (Before)', 50, thumbY);
    doc.image(inspection.image_before_path, 50, thumbY + 16, { width: thumbWidth });

    doc.fontSize(12).text('Current Image (After)', 50 + thumbWidth + 30, thumbY);
    doc.image(inspection.image_after_path, 50 + thumbWidth + 30, thumbY + 16, { width: thumbWidth });

    const thumbHeightEstimate = thumbWidth; // safe upper bound for spacing
    doc.y = thumbY + 16 + thumbHeightEstimate + 20;

    // Large processed image: the "after" image with the detected
    // change regions drawn on top as a high-contrast overlay (REQ-CORE-03
    // is normally the ML/backend's job at inference time; since the mock
    // ML service only returns bounding boxes today, we render the overlay
    // here at report time from the same box data used on the results page).
    doc.addPage();
    doc.fontSize(14).text('Processed Image — Detected Changes', { align: 'center' });
    doc.moveDown();

    const pageWidth = doc.page.width - 100;
    const img = doc.openImage(inspection.image_after_path);
    const displayWidth = pageWidth;
    const scale = displayWidth / img.width;
    const imgX = 50;
    const imgY = doc.y;

    doc.image(img, imgX, imgY, { width: displayWidth });

    doc.lineWidth(2).strokeColor('#ff2d55');
    for (const box of boundingBoxes) {
      doc.rect(
        imgX + box.x * scale,
        imgY + box.y * scale,
        box.w * scale,
        box.h * scale
      ).stroke();
    }
    doc.strokeColor('black');

    // pdfkit does not advance the text cursor (doc.y) for doc.image() calls
    // the way it does for doc.text() — so without this, the conclusion text
    // below would render at the stale cursor position from before the image
    // and overlap it. Compute the image's actual rendered height and move
    // the cursor below it explicitly.
    const displayHeight = img.height * scale;
    doc.y = imgY + displayHeight + 20;
    if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
      // Not enough room left on this page for the conclusion — start a new one.
      doc.addPage();
    }

    // Textual conclusion
    doc.fontSize(12).fillColor('black');
    const conclusion = results?.changes_detected
      ? `Changes were detected between the reference and current images (${boundingBoxes.length} region${boundingBoxes.length === 1 ? '' : 's'} flagged). Confirm on-site before enforcement action.`
      : 'No significant changes were detected between the reference and current images.';
    doc.text(`Conclusion: ${conclusion}`);

    logger.logUserAction('report_download', { userId: req.user.userId, inspectionId: inspection.id });

    doc.end();

  } catch (err) {
    logger.error('Report generation error', { message: err.message, stack: err.stack, inspectionId: id, userId: req.user.userId });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.end();
    }
  }
});

module.exports = router;
