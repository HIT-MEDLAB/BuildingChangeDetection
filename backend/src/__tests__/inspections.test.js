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