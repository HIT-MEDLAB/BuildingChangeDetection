const request = require('supertest');
const app = require('../app');

jest.mock('../config/db', () => ({
  query: jest.fn()
}));

const pool = require('../config/db');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'test_secret_123';

const adminToken = jwt.sign({ userId: 1, email: 'admin@test.com', role: 'admin' }, 'test_secret_123');
const inspectorToken = jwt.sign({ userId: 2, email: 'inspector@test.com', role: 'inspector' }, 'test_secret_123');

describe('GET /api/admin/users', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 401 if no token provided', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  test('returns 403 if caller is not an admin', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${inspectorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Admin access required');
  });

  test('returns the user list for an admin', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, email: 'admin@test.com', name: 'Admin', role: 'admin', is_active: true, created_at: '2026-07-01' },
        { id: 2, email: 'inspector@test.com', name: 'Inspector', role: 'inspector', is_active: true, created_at: '2026-07-02' }
      ]
    });

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.users[0]).toEqual({
      id: 1, email: 'admin@test.com', name: 'Admin', role: 'admin', isActive: true, createdAt: '2026-07-01'
    });
  });
});

describe('POST /api/admin/users', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 403 if caller is not an admin', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${inspectorToken}`)
      .send({ email: 'new@test.com', password: 'pw', name: 'New' });

    expect(res.status).toBe(403);
  });

  test('returns 400 for an invalid role', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'new@test.com', password: 'pw', name: 'New', role: 'superuser' });

    expect(res.status).toBe(400);
  });

  test('creates a user as an admin', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 3, email: 'new@test.com', name: 'New', role: 'inspector', is_active: true, created_at: '2026-07-18' }]
    });

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'new@test.com', password: 'pw', name: 'New' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('new@test.com');
  });
});

describe('PATCH /api/admin/users/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 403 if caller is not an admin', async () => {
    const res = await request(app)
      .patch('/api/admin/users/2')
      .set('Authorization', `Bearer ${inspectorToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(403);
  });

  test('rejects an admin disabling their own account', async () => {
    const res = await request(app)
      .patch('/api/admin/users/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(400);
  });

  test('disables another user', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // existence check
      .mockResolvedValueOnce({
        rows: [{ id: 2, email: 'inspector@test.com', name: 'Inspector', role: 'inspector', is_active: false, created_at: '2026-07-02' }]
      });

    const res = await request(app)
      .patch('/api/admin/users/2')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  test('returns 404 for a nonexistent user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/admin/users/999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(404);
  });
});
