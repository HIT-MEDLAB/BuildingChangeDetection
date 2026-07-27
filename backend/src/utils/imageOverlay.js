const sharp = require('sharp');

// Shared with backend/src/routes/report.js so the standalone processed image
// and the PDF report's "Processed Image" page always use the same
// high-contrast overlay color (REQ-CORE-03) — one constant instead of two
// copies that could silently drift apart.
const OVERLAY_COLOR = '#ff2d55';
const OVERLAY_STROKE_WIDTH = 4;

/**
 * REQ-CORE-03: generate a new image based on the Current ("after") image,
 * drawing a high-contrast overlay that highlights only the detected changes.
 *
 * Renders an SVG of the bounding boxes at the source image's own resolution
 * and composites it on top with sharp, then writes the result to
 * `outputPath`. If `boundingBoxes` is empty, this still produces a
 * (re-encoded) copy of the source image, so a processed image is always
 * available for a completed inspection (REQ-CORE-04/05), even when the
 * model found nothing to flag.
 *
 * @param {string} sourceImagePath - path to the "after" image on disk
 * @param {Array<{x:number,y:number,w:number,h:number}>} boundingBoxes
 * @param {string} outputPath - where to write the processed image (PNG)
 * @returns {Promise<string>} outputPath, for convenience
 */
async function generateProcessedImage(sourceImagePath, boundingBoxes, outputPath) {
  const image = sharp(sourceImagePath);
  const metadata = await image.metadata();
  const width = metadata.width;
  const height = metadata.height;

  const boxes = Array.isArray(boundingBoxes) ? boundingBoxes : [];

  const rects = boxes
    .map((box) => {
      const x = Number(box.x) || 0;
      const y = Number(box.y) || 0;
      const w = Number(box.w) || 0;
      const h = Number(box.h) || 0;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
        `fill="none" stroke="${OVERLAY_COLOR}" stroke-width="${OVERLAY_STROKE_WIDTH}" />`;
    })
    .join('');

  const svgOverlay = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`
  );

  await image
    .composite([{ input: svgOverlay, top: 0, left: 0 }])
    .png()
    .toFile(outputPath);

  return outputPath;
}

module.exports = { generateProcessedImage, OVERLAY_COLOR, OVERLAY_STROKE_WIDTH };
