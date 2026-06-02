const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');

 router.use(authenticate);


// POST /api/inspections/upload
// TODO: Implement image upload
// Steps:
//   1. Accept multipart form data with two images (use multer package)
//   2. Validate file types and sizes
//   3. Save files to disk (or cloud storage — your choice)
//   4. Create an inspection record in the database with status "pending"
//   5. Send the images to the ML service for processing (async)
//   6. Return the inspection ID to the client
//
// Package you'll need: npm install multer
router.post('/upload', (req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    hint: 'Implement image upload with multer — see docs/api-spec.md',
  });
});

// GET /api/inspections/:id
// TODO: Implement single inspection retrieval
// Steps:
//   1. Query the database for the inspection by ID
//   2. Verify the inspection belongs to the authenticated user
//   3. Include the results if processing is complete
//   4. Return 404 if not found
router.get('/:id', (req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    hint: 'Implement inspection retrieval by ID — see docs/api-spec.md',
  });
});

// GET /api/inspections/history
// TODO: Implement paginated inspection history
// Steps:
//   1. Parse query params (page, limit, filters)
//   2. Query the database with pagination (LIMIT/OFFSET)
//   3. Return the list with pagination metadata
router.get('/', (req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    hint: 'Implement inspection history with pagination — see docs/api-spec.md',
  });
});

module.exports = router;
