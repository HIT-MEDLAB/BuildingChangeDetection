const express = require('express');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const router = express.Router();
const authenticate = require('../middleware/authenticate');
const pool = require('../config/db');
const logger = require('../config/logger');
const { OVERLAY_COLOR } = require('../utils/imageOverlay');

router.use(authenticate);

// --- Report styling (shared brand palette with the project's slide deck) ---
const DARK_NAVY = '#343E47';
const TEAL = '#3DB2AA';
const GOLD = '#EDA900';
const LIGHT_BG = '#F4F5F6';
const BORDER_GRAY = '#D9DCDE';
const TEXT_GRAY = '#6B7280';

const CASE_STATUS_COLORS = {
  under_review: GOLD,
  confirmed: TEAL,
  dismissed: TEXT_GRAY
};

const PAGE_MARGIN = 50;

// Draws the dark header band used on every page, with a title and an
// optional right-aligned subtitle (e.g. the inspection reference number).
// Resets doc.y to just below the band so callers can keep laying content
// out normally with doc.text()/doc.moveDown().
function drawHeader(doc, title, subtitle) {
  const headerHeight = 64;
  doc.rect(0, 0, doc.page.width, headerHeight).fill(DARK_NAVY);

  doc.fillColor('white').font('Helvetica-Bold').fontSize(18)
    .text(title, PAGE_MARGIN, 20, { width: doc.page.width - PAGE_MARGIN * 2 - 100 });

  if (subtitle) {
    doc.font('Helvetica').fontSize(11).fillColor('#C9CDD1')
      .text(subtitle, doc.page.width - PAGE_MARGIN - 120, 26, { width: 120, align: 'right' });
  }

  doc.fillColor('black').font('Helvetica');
  doc.y = headerHeight + 24;
}

// Small rounded pill with a colored background, e.g. for a status label
// or an image caption. Returns the pill's rendered height for layout.
function drawPill(doc, text, x, y, { bg = DARK_NAVY, color = 'white', fontSize = 9 } = {}) {
  doc.font('Helvetica-Bold').fontSize(fontSize);
  const paddingX = 8;
  const textWidth = doc.widthOfString(text);
  const height = fontSize + 8;
  const width = textWidth + paddingX * 2;

  doc.roundedRect(x, y, width, height, height / 2).fill(bg);
  doc.fillColor(color).text(text, x + paddingX, y + 4, { width: textWidth, lineBreak: false });
  doc.fillColor('black').font('Helvetica');
  return height;
}

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
              i.processed_image_path,
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
    const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="inspection-${inspection.id}-report.pdf"`
    );

    doc.pipe(res);

    // --- Page 1: header + metadata card + thumbnails ---
    drawHeader(doc, 'Building Inspection Report', `#${inspection.id}`);

    // Metadata card: a light bordered box with label/value rows, instead of
    // plain stacked text lines.
    const metaX = PAGE_MARGIN;
    const metaWidth = doc.page.width - PAGE_MARGIN * 2;
    const metaRows = [
      ['Building', inspection.building_id || '—'],
      ['Inspector', `${inspection.user_name} (${inspection.user_email})`],
      ['Date', new Date(inspection.created_at).toISOString()]
    ];
    if (inspection.notes) {
      metaRows.push(['Notes', inspection.notes]);
    }

    const rowHeight = 18;
    const metaPaddingY = 14;
    const metaHeight = metaPaddingY * 2 + rowHeight * metaRows.length;
    const metaY = doc.y;

    doc.roundedRect(metaX, metaY, metaWidth, metaHeight, 6)
      .fillAndStroke(LIGHT_BG, BORDER_GRAY);

    let rowY = metaY + metaPaddingY;
    doc.fontSize(10);
    for (const [label, value] of metaRows) {
      doc.font('Helvetica-Bold').fillColor(TEXT_GRAY)
        .text(label.toUpperCase(), metaX + 16, rowY, { width: 90 });
      doc.font('Helvetica').fillColor('black')
        .text(value, metaX + 110, rowY, { width: metaWidth - 126 });
      rowY += rowHeight;
    }

    // Case status pill, right-aligned inside the card's top row.
    const caseStatusLabel = (inspection.case_status || 'under_review').replace(/_/g, ' ');
    const pillColor = CASE_STATUS_COLORS[inspection.case_status] || GOLD;
    doc.fontSize(9);
    const pillWidth = doc.widthOfString(caseStatusLabel.toUpperCase()) + 16;
    drawPill(doc, caseStatusLabel.toUpperCase(), metaX + metaWidth - pillWidth - 16, metaY + metaPaddingY - 2, { bg: pillColor });

    doc.fillColor('black').font('Helvetica');
    doc.y = metaY + metaHeight + 28;

    // Thumbnails: reference ("before") and current ("after") images, each
    // with a small caption pill and a thin border around the image itself.
    const thumbWidth = 220;
    const thumbGap = doc.page.width - PAGE_MARGIN * 2 - thumbWidth * 2;
    const beforeX = PAGE_MARGIN;
    const afterX = PAGE_MARGIN + thumbWidth + thumbGap;
    const thumbY = doc.y;

    const beforeImg = doc.openImage(inspection.image_before_path);
    const afterImg = doc.openImage(inspection.image_after_path);
    const beforeThumbHeight = thumbWidth * (beforeImg.height / beforeImg.width);
    const afterThumbHeight = thumbWidth * (afterImg.height / afterImg.width);

    const pillHeight = drawPill(doc, 'REFERENCE (BEFORE)', beforeX, thumbY, { bg: DARK_NAVY });
    drawPill(doc, 'CURRENT (AFTER)', afterX, thumbY, { bg: DARK_NAVY });

    const imageTop = thumbY + pillHeight + 8;
    doc.image(beforeImg, beforeX, imageTop, { width: thumbWidth });
    doc.rect(beforeX, imageTop, thumbWidth, beforeThumbHeight).lineWidth(1).stroke(BORDER_GRAY);

    doc.image(afterImg, afterX, imageTop, { width: thumbWidth });
    doc.rect(afterX, imageTop, thumbWidth, afterThumbHeight).lineWidth(1).stroke(BORDER_GRAY);

    doc.y = imageTop + Math.max(beforeThumbHeight, afterThumbHeight) + 20;

    // --- Page 2: processed image + conclusion ---
    // REQ-CORE-03 generates this once, at upload time, as a real stored file
    // (backend/src/utils/imageOverlay.js) — the same file returned to the
    // client at GET /api/inspections/:id (REQ-CORE-05). Embed that exact
    // file here so the report and the standalone processed image can never
    // show different boxes. Only for inspections that predate migration 003,
    // or where generation failed at upload time, do we fall back to drawing
    // the boxes live from the same box data (using the same OVERLAY_COLOR
    // the shared module uses).
    doc.addPage();
    drawHeader(doc, 'Processed Image', `#${inspection.id}`);

    const pageWidth = doc.page.width - PAGE_MARGIN * 2;
    const hasStoredProcessedImage = inspection.processed_image_path
      && fs.existsSync(inspection.processed_image_path);
    const img = doc.openImage(
      hasStoredProcessedImage ? inspection.processed_image_path : inspection.image_after_path
    );
    const displayWidth = pageWidth;
    const scale = displayWidth / img.width;
    const imgX = PAGE_MARGIN;
    const imgY = doc.y;
    const displayHeight = img.height * scale;

    doc.image(img, imgX, imgY, { width: displayWidth });

    if (!hasStoredProcessedImage) {
      // Boxes are trusted as-is here: they're expected to already be in the
      // same pixel coordinate space as the real "after" image (see the
      // ml-service's /predict — a mismatch there is what used to make boxes
      // land outside the image or in the wrong spot on this page).
      doc.lineWidth(2).strokeColor(OVERLAY_COLOR);
      for (const box of boundingBoxes) {
        doc.rect(
          imgX + box.x * scale,
          imgY + box.y * scale,
          box.w * scale,
          box.h * scale
        ).stroke();
      }
      doc.strokeColor('black');
    }

    // Thin border around the processed image, matching the page-1 thumbnails.
    doc.rect(imgX, imgY, displayWidth, displayHeight).lineWidth(1).stroke(BORDER_GRAY);

    // pdfkit does not advance the text cursor (doc.y) for doc.image() calls
    // the way it does for doc.text() — so without this, the conclusion below
    // would render at the stale cursor position from before the image and
    // overlap it. Move the cursor below the image's actual rendered height.
    doc.y = imgY + displayHeight + 24;
    const conclusionHeight = 70;
    if (doc.y > doc.page.height - doc.page.margins.bottom - conclusionHeight) {
      // Not enough room left on this page for the conclusion - start a new one.
      doc.addPage();
      doc.y = PAGE_MARGIN;
    }

    // Conclusion callout: a colored left accent bar + light background,
    // instead of a plain paragraph, so it reads as a distinct takeaway
    // rather than more body text.
    const conclusion = results?.changes_detected
      ? `Changes were detected between the reference and current images (${boundingBoxes.length} region${boundingBoxes.length === 1 ? '' : 's'} flagged). Confirm on-site before enforcement action.`
      : 'No significant changes were detected between the reference and current images.';
    const accentColor = results?.changes_detected ? GOLD : TEAL;

    const calloutX = PAGE_MARGIN;
    const calloutWidth = doc.page.width - PAGE_MARGIN * 2;
    const calloutY = doc.y;
    doc.font('Helvetica-Bold').fontSize(11);
    const bodyHeight = doc.heightOfString(conclusion, { width: calloutWidth - 32 });
    const calloutHeight = 40 + bodyHeight;

    doc.rect(calloutX, calloutY, calloutWidth, calloutHeight).fill(LIGHT_BG);
    doc.rect(calloutX, calloutY, 4, calloutHeight).fill(accentColor);

    doc.fillColor(DARK_NAVY).font('Helvetica-Bold').fontSize(11)
      .text('CONCLUSION', calloutX + 16, calloutY + 12);
    doc.fillColor('black').font('Helvetica').fontSize(11)
      .text(conclusion, calloutX + 16, calloutY + 28, { width: calloutWidth - 32 });

    doc.fillColor('black');

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
