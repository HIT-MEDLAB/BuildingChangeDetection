const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Set a test secret for JWT
process.env.JWT_SECRET = 'test_secret_123';

describe('Password hashing', () => {
  test('hashes a password and verifies it correctly', async () => {
    const password = 'password123';
    const hash = await bcrypt.hash(password, 10);

    expect(hash).not.toBe(password);
    const isValid = await bcrypt.compare(password, hash);
    expect(isValid).toBe(true);
  });

  test('rejects a wrong password', async () => {
    const hash = await bcrypt.hash('correct_password', 10);
    const isValid = await bcrypt.compare('wrong_password', hash);
    expect(isValid).toBe(false);
  });
});

describe('JWT', () => {
  test('signs and verifies a token correctly', () => {
    const payload = { userId: 1, email: 'test@test.com' };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.userId).toBe(1);
    expect(decoded.email).toBe('test@test.com');
  });

  test('rejects a token signed with wrong secret', () => {
    const token = jwt.sign({ userId: 1 }, 'wrong_secret');
    expect(() => jwt.verify(token, process.env.JWT_SECRET)).toThrow();
  });

  test('rejects an expired token', () => {
    const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: '0s' });
    expect(() => jwt.verify(token, process.env.JWT_SECRET)).toThrow();
  });
});