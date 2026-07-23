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