'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AuthUser = require('../models/user.model');
const AppError = require('../utils/AppError');
const config = require('../config');

// ---------------------
// CONSTANTS
// ---------------------
const API_KEY_BYTES = 32; // 256-bit → 64-char hex string
const API_KEY_HASH_ROUNDS = 12;

// ---------------------
// HELPER — Raw API Key generation
// ---------------------
/**
 * Generates a cryptographically secure, URL-safe API Key.
 * Returns the raw hex string. This value MUST be shown to the user exactly once
 * and NEVER persisted in plaintext.
 *
 * @returns {string} 64-character hex API Key
 */
const generateRawApiKey = () => crypto.randomBytes(API_KEY_BYTES).toString('hex');

// ---------------------
// HELPER — JWT signing
// ---------------------
/**
 * Signs a short-lived JWT containing the user's identity claims.
 *
 * @param {{ id: string, email: string, role: string }} payload
 * @returns {string} Signed JWT
 */
const signJwt = (payload) => {
  if (!config.jwtSecret) {
    throw new AppError('JWT secret is not configured', 500);
  }
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    issuer: 'auth-microservice',
  });
};

// ---------------------
// SERVICE — Register
// ---------------------
/**
 * State Creation Operation: creates a new AuthUser.
 *
 * @param {{ email: string, password: string, role?: string }} dto
 * @returns {{ user: object, apiKey: string }} The saved user (sanitised) and the one-time plaintext API Key.
 * @throws {AppError} 409 if email already exists.
 */
const register = async ({ email, password, role }) => {
  // 1. Idempotency guard — email must be unique
  const existing = await AuthUser.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  // 2. Generate API Key — plaintext (shown once) + hash (persisted)
  const rawApiKey = generateRawApiKey();
  const apiKeyHash = await bcrypt.hash(rawApiKey, API_KEY_HASH_ROUNDS);

  // 3. Persist — password is hashed by the pre-save hook on the model
  const user = await AuthUser.create({
    email,
    password,
    role: role || 'user',
    apiKeyHash,
  });

  // 4. Return sanitised user doc + one-time plaintext key
  return { user: user.toJSON(), apiKey: rawApiKey };
};

// ---------------------
// SERVICE — Login
// ---------------------
/**
 * Computation Function: validates credentials and issues a JWT.
 *
 * @param {{ email: string, password: string }} dto
 * @returns {{ user: object, token: string }} Sanitised user doc and signed JWT.
 * @throws {AppError} 401 for invalid credentials. 403 if account is not active.
 */
const login = async ({ email, password }) => {
  // 1. Fetch user — explicitly select password (select: false in schema)
  const user = await AuthUser.findOne({ email: email.toLowerCase().trim() }).select(
    '+password'
  );

  // Use a generic message to avoid user-enumeration attacks
  const invalidCredentialsError = new AppError('Invalid email or password', 401);

  if (!user) throw invalidCredentialsError;

  // 2. Verify password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw invalidCredentialsError;

  // 3. Account lifecycle check
  if (user.status !== 'active') {
    throw new AppError(
      `Account is ${user.status}. Please contact support.`,
      403
    );
  }

  // 4. Issue JWT
  const token = signJwt({ id: user.id, email: user.email, role: user.role });

  return { user: user.toJSON(), token };
};

module.exports = { register, login };
