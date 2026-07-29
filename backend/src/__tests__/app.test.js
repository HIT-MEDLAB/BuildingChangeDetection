const request = require('supertest');
const fs = require('fs');
const path = require('path');

jest.mock('../config/db', () => ({ query: jest.fn() }));

process.env.JWT_SECRET = 'test_secret_123';
const app = require('../app');

describe('static file serving (/uploads)', () => {
  // US-2 / REQ-CORE-04/05: image_before_path, image_after_path and
  // processed_image_path are returned to the client as relative paths like
  // "uploads/<uuid>.png" - this only works if the server actually serves
  // that directory. Regression test for a gap found while double-checking
  // this week's PRD closure: nothing served /uploads at all before this.
  const uploadsDir = path.join(__dirname, '../../uploads');
  const filename = 'static-serving-test.txt';
  const filePath = path.join(uploadsDir, filename);

  beforeAll(() => {
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(filePath, 'test content');
  });

  afterAll(() => {
    fs.unlinkSync(filePath);
  });

  test('a file placed in uploads/ is reachable at /uploads/<filename>', async () => {
    const res = await request(app).get(`/uploads/${filename}`);
    expect(res.status).toBe(200);
    expect(res.text).toBe('test content');
  });

  test('returns 404 for a file that does not exist', async () => {
    const res = await request(app).get('/uploads/does-not-exist.png');
    expect(res.status).toBe(404);
  });
});
