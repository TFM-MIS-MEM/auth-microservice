'use strict';

/**
 * Integration tests for Auth endpoints:
 *   POST /api/v1/auth/register
 *   POST /api/v1/auth/login
 *
 * Uses an in-memory MongoDB so no real database is required.
 * JWT_SECRET is set in the test environment via jest.config.js or inline below.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Set JWT_SECRET before requiring app (config is read at module load)
process.env.JWT_SECRET = 'test-secret-for-jest-suite-do-not-use-in-production';
process.env.NODE_ENV = 'test';

const app = require('../src/app');
const AuthUser = require('../src/models/user.model');

// ---------------------
// Setup / Teardown
// ---------------------
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await AuthUser.deleteMany({});
});

// =====================================================
// POST /api/v1/auth/register
// =====================================================
describe('POST /api/v1/auth/register', () => {
  const validPayload = {
    email: 'newuser@example.com',
    password: 'SuperSecret123!',
    role: 'user',
  };

  it('201 — registers a new user and returns a one-time API Key', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validPayload);

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('apiKey');
    expect(typeof res.body.data.apiKey).toBe('string');
    expect(res.body.data.apiKey).toHaveLength(64); // 32 bytes → 64 hex chars
  });

  it('201 — returned user object does not contain password or apiKeyHash', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validPayload);

    expect(res.statusCode).toBe(201);
    const user = res.body.data.user;
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('apiKeyHash');
    expect(user).not.toHaveProperty('__v');
  });

  it('201 — user is persisted with default role "user" when role is omitted', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'norole@example.com', password: 'Password123!' });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.user.role).toBe('user');
  });

  it('201 — correctly assigns researcher role', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'researcher@example.com', password: 'Password123!', role: 'researcher' });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.user.role).toBe('researcher');
  });

  it('409 — returns Conflict when email already exists', async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
    const res = await request(app).post('/api/v1/auth/register').send(validPayload);

    expect(res.statusCode).toBe(409);
    expect(res.body.status).toBe('fail');
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('400 — returns Validation error when email is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ password: 'Secret123!' });

    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.message).toMatch(/validation error/i);
  });

  it('400 — returns Validation error when password is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'short@example.com', password: '123' });

    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe('fail');
  });

  it('400 — returns Validation error when email format is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'Password123!' });

    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe('fail');
  });
});

// =====================================================
// POST /api/v1/auth/login
// =====================================================
describe('POST /api/v1/auth/login', () => {
  const credentials = { email: 'login@example.com', password: 'MyPassword123!' };

  beforeEach(async () => {
    // Register a user to log in with
    await request(app).post('/api/v1/auth/register').send(credentials);
  });

  it('200 — returns a JWT token on valid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send(credentials);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('token');
    expect(typeof res.body.data.token).toBe('string');
    // Basic JWT structure check: 3 dot-separated base64 segments
    expect(res.body.data.token.split('.')).toHaveLength(3);
  });

  it('200 — returned user does not contain password or apiKeyHash', async () => {
    const res = await request(app).post('/api/v1/auth/login').send(credentials);

    expect(res.statusCode).toBe(200);
    const user = res.body.data.user;
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('apiKeyHash');
  });

  it('401 — returns Unauthorized for wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: 'WrongPassword!' });

    expect(res.statusCode).toBe(401);
    expect(res.body.status).toBe('fail');
    // Must use generic message to prevent user enumeration
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('401 — returns Unauthorized for non-existent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@example.com', password: 'Password123!' });

    expect(res.statusCode).toBe(401);
    expect(res.body.status).toBe('fail');
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('403 — returns Forbidden when account is suspended', async () => {
    await AuthUser.findOneAndUpdate(
      { email: credentials.email },
      { status: 'suspended' }
    );

    const res = await request(app).post('/api/v1/auth/login').send(credentials);

    expect(res.statusCode).toBe(403);
    expect(res.body.status).toBe('fail');
    expect(res.body.message).toMatch(/suspended/i);
  });

  it('400 — returns Validation error when email is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ password: 'Password123!' });

    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe('fail');
  });

  it('400 — returns Validation error when password is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: credentials.email });

    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe('fail');
  });
});
