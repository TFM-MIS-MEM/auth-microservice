'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const AuthUser = require('../models/user.model');
const AppError = require('../utils/AppError');
const config = require('../config');

// Initialize Resend with API Key from environment
const resend = new Resend(config.resendApiKey);

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
// HELPER — Resend Email
// ---------------------
/**
 * Uses Resend to send the password reset token URL to the user.
 * Real mechanism, replacing local logs.
 *
 * @param {string} email
 * @param {string} token
 */
const sendResetEmail = async (email, token) => {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;

  try {
    const { error } = await resend.emails.send({
      from: 'TFM SaaS Auth <onboarding@resend.dev>', // Should be a verified domain in prod
      to: email,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset. Please click the link below to set a new password:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link is valid for 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });

    if (error) {
      console.error('Email sending failed (Resend API Error):', error);
      throw new Error(error.message);
    }
  } catch (err) {
    console.error('Email sending failed:', err);
    throw new AppError('There was an error sending the email. Try again later.', 500);
  }
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

// ---------------------
// SERVICE — Forgot Password
// ---------------------
/**
 * Initiates the password recovery flow. Generates a token and sends email.
 */
const forgotPassword = async (email) => {
  const user = await AuthUser.findOne({ email: email.toLowerCase().trim() });
  
  if (!user) {
    throw new AppError('There is no account associated with this email address.', 404);
  }

  // Generate random token and hash it (handled by model instance)
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    await sendResetEmail(user.email, resetToken);
  } catch (err) {
    // Revert token state if email fails
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    
    throw err;
  }
};

// ---------------------
// SERVICE — Reset Password
// ---------------------
/**
 * Completes the recovery flow. Validates token hash and saves new password.
 */
const resetPassword = async (token, newPassword) => {
  // Hash the incoming token
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // Find user based on token hash and ensure it's not expired
  const user = await AuthUser.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new AppError('Token is invalid or has expired', 400);
  }

  // Apply new password and clear token fields
  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  
  await user.save();
};

// ---------------------
// SERVICE — Change Password
// ---------------------
/**
 * Allows an authenticated logged-in user to change their known password.
 */
const changePassword = async (userId, oldPassword, newPassword) => {
  // Explicitly fetch password field
  const user = await AuthUser.findById(userId).select('+password');
  if (!user) throw new AppError('User not found', 404);

  // Validate old password
  const isMatch = await user.comparePassword(oldPassword);
  if (!isMatch) {
    throw new AppError('The old password you entered is incorrect', 401);
  }

  // Update logic
  user.password = newPassword;
  await user.save();
};

// ---------------------
// SERVICE — Rotate API Key
// ---------------------
/**
 * Generates a new raw API Key for an authenticated user, revoking the previous one.
 */
const rotateApiKey = async (userId) => {
  const user = await AuthUser.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  const rawApiKey = generateRawApiKey();
  const apiKeyHash = await bcrypt.hash(rawApiKey, API_KEY_HASH_ROUNDS);

  user.apiKeyHash = apiKeyHash;
  await user.save();

  return rawApiKey;
};

// ---------------------
// SERVICE — Get Me (Status)
// ---------------------
/**
 * Retrieves fresh user data from the database.
 * Explicitly sanitised by the model's toJSON transform.
 */
const getMe = async (userId) => {
  const user = await AuthUser.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  return user.toJSON();
};

// ---------------------
// SERVICE — Delete Account
// ---------------------
/**
 * Completely removes the user document from the database.
 */
const deleteAccount = async (userId) => {
  const user = await AuthUser.findByIdAndDelete(userId);
  if (!user) throw new AppError('User not found', 404);
};

module.exports = { 
  register, 
  login, 
  forgotPassword, 
  resetPassword, 
  changePassword, 
  rotateApiKey,
  getMe,
  deleteAccount
};
