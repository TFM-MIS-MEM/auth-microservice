'use strict';

/**
 * Unit tests for src/models/user.model.js
 *
 * Strategy:
 *  - Use an in-memory mongoose connection so tests are fully isolated
 *    from any real MongoDB instance (no integration dependency).
 *  - Tests cover:
 *      1. Schema validation (required fields, email format, enum constraints)
 *      2. Pre-save hook (password is hashed; re-hash skipped when unmodified)
 *      3. comparePassword instance method (match / no-match paths)
 *      4. Security invariants (select:false fields absent from plain queries)
 *      5. toJSON transform (id aliasing, no leaked sensitive fields)
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const AuthUser = require('../src/models/user.model');

// ---------------------
// Test helpers
// ---------------------
const buildValidPayload = (overrides = {}) => ({
  email: 'test@example.com',
  password: 'SuperSecret123!',
  ...overrides,
});

// ---------------------
// Setup / Teardown
// ---------------------
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await AuthUser.deleteMany({});
});

// =====================
// 1. Schema Validation
// =====================
describe('AuthUser — Schema Validation', () => {
  it('should save successfully with valid email and password', async () => {
    const user = new AuthUser(buildValidPayload());
    await expect(user.save()).resolves.toBeDefined();
  });

  it('should require email', async () => {
    const user = new AuthUser({ password: 'Secret1!' });
    await expect(user.save()).rejects.toThrow(/Email is required/);
  });

  it('should require password', async () => {
    const user = new AuthUser({ email: 'test@example.com' });
    await expect(user.save()).rejects.toThrow(/Password is required/);
  });

  it('should reject an invalid email format', async () => {
    const user = new AuthUser(buildValidPayload({ email: 'not-an-email' }));
    await expect(user.save()).rejects.toThrow(/Invalid email format/);
  });

  it('should enforce email uniqueness', async () => {
    await AuthUser.create(buildValidPayload());
    const duplicate = new AuthUser(buildValidPayload());
    await expect(duplicate.save()).rejects.toThrow(/duplicate key/i);
  });

  it('should lowercase and trim the email before saving', async () => {
    const user = await AuthUser.create(
      buildValidPayload({ email: '  User@Example.COM  ' })
    );
    expect(user.email).toBe('user@example.com');
  });

  it('should default role to "user"', async () => {
    const user = await AuthUser.create(buildValidPayload());
    expect(user.role).toBe('user');
  });

  it('should accept valid roles', async () => {
    for (const role of ['user', 'admin', 'researcher']) {
      await AuthUser.deleteMany({});
      const user = await AuthUser.create(buildValidPayload({ role }));
      expect(user.role).toBe(role);
    }
  });

  it('should reject an invalid role', async () => {
    const user = new AuthUser(buildValidPayload({ role: 'superadmin' }));
    await expect(user.save()).rejects.toThrow(/Role must be one of/);
  });

  it('should default status to "active"', async () => {
    const user = await AuthUser.create(buildValidPayload());
    expect(user.status).toBe('active');
  });

  it('should reject an invalid status', async () => {
    const user = new AuthUser(buildValidPayload({ status: 'banned' }));
    await expect(user.save()).rejects.toThrow(/Status must be one of/);
  });

  it('should add timestamps (createdAt, updatedAt) automatically', async () => {
    const user = await AuthUser.create(buildValidPayload());
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });
});

// ==========================
// 2. Pre-Save Hook (Hashing)
// ==========================
describe('AuthUser — Pre-Save Hook (password hashing)', () => {
  it('should store a bcrypt hash instead of the plaintext password', async () => {
    const plaintext = 'SuperSecret123!';
    const user = await AuthUser.create(buildValidPayload({ password: plaintext }));

    // Fetch explicitly projecting password back in
    const persisted = await AuthUser.findById(user._id).select('+password');
    expect(persisted.password).not.toBe(plaintext);
    expect(persisted.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt signature
  });

  it('should not re-hash the password when only non-password fields are updated', async () => {
    const user = await AuthUser.create(buildValidPayload());

    const persisted = await AuthUser.findById(user._id).select('+password');
    const hashBefore = persisted.password;

    persisted.role = 'admin';
    await persisted.save();

    const afterUpdate = await AuthUser.findById(user._id).select('+password');
    expect(afterUpdate.password).toBe(hashBefore);
  });

  it('should re-hash the password when it is explicitly changed', async () => {
    const user = await AuthUser.create(buildValidPayload());

    const persisted = await AuthUser.findById(user._id).select('+password');
    const hashBefore = persisted.password;

    persisted.password = 'NewPassword456!';
    await persisted.save();

    const afterUpdate = await AuthUser.findById(user._id).select('+password');
    expect(afterUpdate.password).not.toBe(hashBefore);
    expect(afterUpdate.password).toMatch(/^\$2[aby]\$\d+\$/);
  });
});

// ===============================
// 3. comparePassword Method
// ===============================
describe('AuthUser — comparePassword()', () => {
  it('should return true when the candidate matches the stored hash', async () => {
    const plaintext = 'SuperSecret123!';
    await AuthUser.create(buildValidPayload({ password: plaintext }));

    const user = await AuthUser.findOne({ email: 'test@example.com' }).select(
      '+password'
    );
    await expect(user.comparePassword(plaintext)).resolves.toBe(true);
  });

  it('should return false for a wrong password', async () => {
    await AuthUser.create(buildValidPayload({ password: 'CorrectHorse!' }));

    const user = await AuthUser.findOne({ email: 'test@example.com' }).select(
      '+password'
    );
    await expect(user.comparePassword('WrongPassword!')).resolves.toBe(false);
  });

  it('should return false for an empty string', async () => {
    await AuthUser.create(buildValidPayload());
    const user = await AuthUser.findOne({ email: 'test@example.com' }).select(
      '+password'
    );
    await expect(user.comparePassword('')).resolves.toBe(false);
  });
});

// =================================
// 4. Security Invariants (select:false)
// =================================
describe('AuthUser — Security: select:false fields', () => {
  it('should NOT return password in a standard find() query', async () => {
    await AuthUser.create(buildValidPayload());
    const user = await AuthUser.findOne({ email: 'test@example.com' });
    expect(user.password).toBeUndefined();
  });

  it('should NOT return apiKeyHash in a standard find() query', async () => {
    await AuthUser.create(buildValidPayload({ apiKeyHash: 'someHash' }));
    const user = await AuthUser.findOne({ email: 'test@example.com' });
    expect(user.apiKeyHash).toBeUndefined();
  });

  it('should expose password when explicitly projected with .select("+password")', async () => {
    await AuthUser.create(buildValidPayload());
    const user = await AuthUser.findOne({ email: 'test@example.com' }).select(
      '+password'
    );
    expect(user.password).toBeDefined();
    expect(typeof user.password).toBe('string');
  });
});

// =================================
// 5. toJSON Transform
// =================================
describe('AuthUser — toJSON transform', () => {
  it('should expose "id" (string) instead of "_id"', async () => {
    const user = await AuthUser.create(buildValidPayload());
    const json = user.toJSON();
    expect(json.id).toBeDefined();
    expect(json._id).toBeUndefined();
  });

  it('should strip "password" from the JSON output', async () => {
    const user = await AuthUser.create(buildValidPayload());
    const json = user.toJSON();
    expect(json.password).toBeUndefined();
  });

  it('should strip "apiKeyHash" from the JSON output', async () => {
    const user = await AuthUser.create(buildValidPayload({ apiKeyHash: 'h4sh' }));
    const json = user.toJSON();
    expect(json.apiKeyHash).toBeUndefined();
  });

  it('should not include __v in the JSON output', async () => {
    const user = await AuthUser.create(buildValidPayload());
    const json = user.toJSON();
    expect(json.__v).toBeUndefined();
  });
});
