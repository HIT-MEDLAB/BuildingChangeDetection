const request = require('supertest');
const app = require('../app');

// Mock the database pool
jest.mock('../config/db', () => ({
  query: jest.fn()
}));

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn());

const pool = require('../config/db');
const fetch = require('node-fetch');

// A valid JWT token for testing (signed with test secret)
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'test_secret_123';
const testToken = jwt.sign({ userId: 1, email: 'test@test.com' }, 'test_secret_123');

describe('POST /api/inspections/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 400 if no files uploaded', async () => {
    const res = await request(app)
      .post('/api/inspections/upload')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Both images are required');
  });

  test('returns 401 if no token provided', async () => {
    const res = await request(app)
      .post('/api/inspections/upload');

    expect(res.status).toBe(401);
  });

  test('marks the inspection failed with a clear message for an incompatible image pair', async () => {
    // NFR-REL-01 / REQ-CORE-06: the ML service can be "up" and still reject a
    // pair it can't compare (corrupt file, mismatched camera angles, etc). The
    // backend should relay that specific reason, not a generic crash.
    const path = require('path');
    const fixtureImage = path.join(__dirname, 'fixtures', 'test-image.png');

    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 42 }] }) // INSERT inspections
      .mockResolvedValueOnce({ rows: [] }); // UPDATE status = 'failed'

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        detail: 'Comparison failed - camera angles are too different between the two images'
      })
    });

    const res = await request(app)
      .post('/api/inspections/upload')
      .set('Authorization', `Bearer ${testToken}`)
      .attach('imageBefore', fixtureImage)
      .attach('imageAfter', fixtureImage);

    expect(res.status).toBe(502);
    expect(res.body.inspectionId).toBe(42);
    expect(res.body.error).toMatch(/camera angles are too different/i);
  });

  test('marks the inspection failed when the ML service returns an unexpected response shape', async () => {
    const path = require('path');
    const fixtureImage = path.join(__dirname, 'fixtures', 'test-image.png');

    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 43 }] })
      .mockResolvedValueOnce({ rows: [] });

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ some: 'unexpected shape' })
    });

    const res = await request(app)
      .post('/api/inspections/upload')
      .set('Authorization', `Bearer ${testToken}`)
      .attach('imageBefore', fixtureImage)
      .attach('imageAfter', fixtureImage);

    expect(res.status).toBe(502);
    expect(res.body.inspectionId).toBe(43);
  });

  test('REQ-CORE-03/04/05: generates and persists a processed image on a successful upload', async () => {
    const path = require('path');
    const fs = require('fs');
    const fixtureImage = path.join(__dirname, 'fixtures', 'test-image.png');

    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 77 }] }) // INSERT inspections
      .mockResolvedValueOnce({ rows: [] }) // INSERT inspection_results
      .mockResolvedValueOnce({ rows: [] }); // UPDATE status = 'completed', processed_image_path = ...

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        changes_detected: true,
        bounding_boxes: [{ x: 10, y: 10, w: 20, h: 20 }],
        confidence: 0.9
      })
    });

    const res = await request(app)
      .post('/api/inspections/upload')
      .set('Authorization', `Bearer ${testToken}`)
      .attach('imageBefore', fixtureImage)
      .attach('imageAfter', fixtureImage);

    expect(res.status).toBe(201);
    expect(res.body.inspectionId).toBe(77);

    // The 3rd pool.query call is the completion UPDATE - assert it was given
    // a real processed_image_path (not null), and that the file actually
    // exists on disk (not just a path string).
    const updateCall = pool.query.mock.calls[2];
    expect(updateCall[0]).toMatch(/processed_image_path/);
    const processedImagePath = updateCall[1][1];
    expect(processedImagePath).toEqual(expect.stringMatching(/^uploads[\/].+\.png$/));
    expect(fs.existsSync(processedImagePath)).toBe(true);

    // Cleanup the generated file (and the two uploaded fixtures multer wrote).
    fs.unlinkSync(processedImagePath);
  });
});

describe('GET /api/inspections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 if no token provided', async () => {
    const res = await request(app).get('/api/inspections');
    expect(res.status).toBe(401);
  });

  test('returns caseStatus (camelCase) and processed_image_path, not the raw case_status column', async () => {
    // Regression test for the naming inconsistency Kiril flagged: this
    // endpoint used to return `case_status` while GET /:id returned
    // `caseStatus`, forcing the frontend to check both spellings.
    pool.query
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          status: 'completed',
          caseStatus: 'confirmed',
          created_at: '2026-07-27T00:00:00Z',
          notes: 'test note',
          image_before_path: 'uploads/before.jpg',
          image_after_path: 'uploads/after.jpg',
          processed_image_path: 'uploads/processed.png',
          changes_detected: true
        }]
      })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/api/inspections')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.inspections[0].caseStatus).toBe('confirmed');
    expect(res.body.inspections[0].case_status).toBeUndefined();
    expect(res.body.inspections[0].processed_image_path).toBe('uploads/processed.png');

    // The SQL itself is what actually produces the camelCase alias against a
    // real DB - assert the query text does the aliasing, since the mock
    // above only proves the route passes rows through unmodified.
    const listQuery = pool.query.mock.calls[0][0];
    expect(listQuery).toMatch(/case_status AS "caseStatus"/);
    expect(listQuery).toMatch(/processed_image_path/);
  });
});

describe('GET /api/inspections/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 if no token provided', async () => {
    const res = await request(app).get('/api/inspections/1');
    expect(res.status).toBe(401);
  });

  test('returns 404 if inspection not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/inspections/999')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(404);
  });

  test('returns 403 if inspection belongs to another user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, user_id: 999 }] });

    const res = await request(app)
      .get('/api/inspections/1')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(403);
  });

  test('US-2: a completed inspection returns both source images, the processed image, boxes, status and note in one response', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{
          id: 5,
          user_id: 1,
          status: 'completed',
          case_status: 'under_review',
          created_at: '2026-07-27T00:00:00Z',
          notes: 'Unpermitted rooftop extension',
          image_before_path: 'uploads/before.jpg',
          image_after_path: 'uploads/after.jpg',
          processed_image_path: 'uploads/processed.png'
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          changes_detected: true,
          result_data: { bounding_boxes: [{ x: 10, y: 10, w: 20, h: 20 }] }
        }]
      });

    const res = await request(app)
      .get('/api/inspections/5')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 5,
      status: 'completed',
      caseStatus: 'under_review',
      notes: 'Unpermitted rooftop extension',
      images: {
        before: 'uploads/before.jpg',
        after: 'uploads/after.jpg',
        processed: 'uploads/processed.png'
      },
      results: {
        changesDetected: true,
        boundingBoxes: [{ x: 10, y: 10, w: 20, h: 20 }]
      }
    });
  });

  test('images.processed is null when the inspection predates migration 003 or generation failed', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{
          id: 6,
          user_id: 1,
          status: 'completed',
          case_status: 'under_review',
          created_at: '2026-07-01T00:00:00Z',
          notes: null,
          image_before_path: 'uploads/before.jpg',
          image_after_path: 'uploads/after.jpg',
          processed_image_path: null
        }]
      })
      .mockResolvedValueOnce({
        rows: [{ changes_detected: false, result_data: { bounding_boxes: [] } }]
      });

    const res = await request(app)
      .get('/api/inspections/6')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.images.processed).toBeNull();
  });
});

describe('DELETE /api/inspections/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 if no token provided', async () => {
    const res = await request(app)
      .delete('/api/inspections/1');

    expect(res.status).toBe(401);
  });

  test('returns 404 if inspection not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/inspections/999')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Inspection not found');
  });

  test('returns 403 if inspection belongs to another user', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, user_id: 999, status: 'completed' }]
    });

    const res = await request(app)
      .delete('/api/inspections/1')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });
});

describe('PATCH /api/inspections/:id/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 if no token provided', async () => {
    const res = await request(app)
      .patch('/api/inspections/1/status')
      .send({ caseStatus: 'confirmed' });

    expect(res.status).toBe(401);
  });

  test('returns 400 for an invalid caseStatus value', async () => {
    const res = await request(app)
      .patch('/api/inspections/1/status')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ caseStatus: 'archived' });

    expect(res.status).toBe(400);
  });

  test('returns 404 if inspection not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/inspections/999/status')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ caseStatus: 'confirmed' });

    expect(res.status).toBe(404);
  });

  test('returns 403 if inspection belongs to another user', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, user_id: 999 }]
    });

    const res = await request(app)
      .patch('/api/inspections/1/status')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ caseStatus: 'confirmed' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  test('updates the case status for the owner', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] })
      .mockResolvedValueOnce({
        rows: [{ id: 1, case_status: 'confirmed', notes: 'Looks like an unpermitted extension', updated_at: '2026-07-18' }]
      });

    const res = await request(app)
      .patch('/api/inspections/1/status')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ caseStatus: 'confirmed', note: 'Looks like an unpermitted extension' });

    expect(res.status).toBe(200);
    expect(res.body.caseStatus).toBe('confirmed');
  });
});

describe('GET /api/inspections/:id/export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 if no token provided', async () => {
    const res = await request(app).get('/api/inspections/1/export');
    expect(res.status).toBe(401);
  });

  test('returns 404 if inspection not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/inspections/999/export')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(404);
  });

  test('returns 403 if inspection belongs to another user', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, user_id: 999, image_before_path: __filename, image_after_path: __filename }]
    });

    const res = await request(app)
      .get('/api/inspections/1/export')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(403);
  });

  test('streams a zip for the owner', async () => {
    const path = require('path');
    const fixtureImage = path.join(__dirname, 'fixtures', 'test-image.png');

    pool.query
      .mockResolvedValueOnce({
        rows: [{
          id: 1, user_id: 1, building_id: 'B-42', status: 'completed',
          case_status: 'confirmed', notes: 'test note', created_at: '2026-07-18T00:00:00Z',
          image_before_path: fixtureImage, image_after_path: fixtureImage
        }]
      })
      .mockResolvedValueOnce({
        rows: [{ changes_detected: true, result_data: { bounding_boxes: [] } }]
      });

    const res = await request(app)
      .get('/api/inspections/1/export')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    // PK is the zip local file header magic number
    expect(res.text.slice(0, 2)).toBe('PK');
  });
});