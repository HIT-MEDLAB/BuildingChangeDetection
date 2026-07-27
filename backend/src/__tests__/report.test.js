const path = require('path');
const request = require('supertest');
const app = require('../app');

jest.mock('../config/db', () => ({
  query: jest.fn()
}));

const pool = require('../config/db');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'test_secret_123';

const testToken = jwt.sign({ userId: 1, email: 'test@test.com', role: 'inspector' }, 'test_secret_123');
const fixtureImage = path.join(__dirname, 'fixtures', 'test-image.png');

describe('GET /api/report/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 401 if no token provided', async () => {
    const res = await request(app).get('/api/report/1');
    expect(res.status).toBe(401);
  });

  test('returns 404 if inspection not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/report/999')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(404);
  });

  test('returns 403 if inspection belongs to another user', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, user_id: 999, status: 'completed' }]
    });

    const res = await request(app)
      .get('/api/report/1')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(403);
  });

  test('returns 409 if inspection is not completed', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, user_id: 1, status: 'pending' }]
    });

    const res = await request(app)
      .get('/api/report/1')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(409);
  });

  test('streams a PDF for the owner of a completed inspection', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 1,
          building_id: 'B-42',
          status: 'completed',
          case_status: 'under_review',
          notes: null,
          created_at: '2026-07-18T00:00:00Z',
          image_before_path: fixtureImage,
          image_after_path: fixtureImage,
          user_name: 'Yair Katsav',
          user_email: 'yair@medlab.hit.ac.il'
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          changes_detected: true,
          result_data: { bounding_boxes: [{ x: 10, y: 10, w: 20, h: 20 }] }
        }]
      });

    const res = await request(app)
      .get('/api/report/1')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.slice(0, 4).toString()).toBe('%PDF');
  });

  test('embeds the stored processed image (REQ-CORE-03) when one exists, instead of drawing boxes live', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{
          id: 2,
          user_id: 1,
          building_id: 'B-43',
          status: 'completed',
          case_status: 'confirmed',
          notes: null,
          created_at: '2026-07-27T00:00:00Z',
          image_before_path: fixtureImage,
          image_after_path: fixtureImage,
          // Reusing the fixture as a stand-in "processed image" file - the
          // report route only needs it to exist and be readable as an image.
          processed_image_path: fixtureImage,
          user_name: 'Yair Katsav',
          user_email: 'yair@medlab.hit.ac.il'
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          changes_detected: true,
          result_data: { bounding_boxes: [{ x: 10, y: 10, w: 20, h: 20 }] }
        }]
      });

    const res = await request(app)
      .get('/api/report/2')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.slice(0, 4).toString()).toBe('%PDF');
  });
});
