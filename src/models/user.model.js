'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * @openapi
 * components:
 *   schemas:
 *     AuthUser:
 *       type: object
 *       description: >
 *         Master Data Holder for authentication identities.
 *         Passwords and API Key hashes are stored as one-way bcrypt digests
 *         and are never returned in API responses (select: false).
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           readOnly: true
 *           example: "64a1f2b3c4d5e6f7a8b9c0d1"
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         role:
 *           type: string
 *           enum: [user, admin, researcher]
 *           default: user
 *         status:
 *           type: string
 *           enum: [active, inactive, suspended]
 *           default: active
 *         createdAt:
 *           type: string
 *           format: date-time
 *           readOnly: true
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           readOnly: true
 *       required:
 *         - email
 */

// ---------------------
// BCRYPT CONFIGURATION
// ---------------------
const SALT_ROUNDS = 12; // NIST SP 800-63B compliant cost factor

// ---------------------
// SCHEMA DEFINITION — Master Data Holder Pattern
// ---------------------
const authUserSchema = new mongoose.Schema(
  {
    /**
     * Primary identifier for the user. Unique across the collection.
     * Validated via regex to prevent injection of malformed addresses.
     */
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Invalid email format',
      ],
      index: true,
    },

    /**
     * Bcrypt hash of the plaintext password.
     * `select: false` ensures this field is NEVER returned in queries
     * unless explicitly projected with `.select('+password')`.
     */
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },

    /**
     * RBAC role. Drives access control decisions across all downstream services.
     * DoD roles: user (client), admin (back-office), researcher (research API).
     */
    role: {
      type: String,
      enum: {
        values: ['user', 'admin', 'researcher'],
        message: 'Role must be one of: user, admin, researcher',
      },
      default: 'user',
    },

    /**
     * SHA-256 hash of the raw API Key for O(1) indexed searches.
     * The plaintext key is only returned once at creation time.
     * `select: false` prevents accidental exposure in list queries.
     */
    apiKeyHash: {
      type: String,
      default: null,
      select: false,
      index: true,
    },

    /**
     * Lifecycle status of the account.
     * - active:    fully operational
     * - inactive:  soft-deleted / not yet verified
     * - suspended: admin action, access blocked
     */
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'suspended'],
        message: 'Status must be one of: active, inactive, suspended',
      },
      default: 'active',
    },

    /**
     * Hashed token used to verify password reset requests.
     * Stored as a hash to mitigate DB leak risks.
     */
    resetPasswordToken: {
      type: String,
      select: false,
    },

    /**
     * Expiration timestamp for the reset token.
     */
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  {
    // Automatic createdAt / updatedAt timestamps
    timestamps: true,

    // Strip internal Mongoose fields (__v) and rename _id → id on serialisation
    toJSON: {
      versionKey: false,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        // Belt-and-suspenders: never leak sensitive fields via toJSON
        delete ret.password;
        delete ret.apiKeyHash;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        return ret;
      },
    },
  }
);

// ---------------------
// PRE-SAVE HOOK — Password Hashing
// ---------------------
/**
 * Hashes `this.password` with bcrypt whenever the field has been modified.
 * Using `isModified` avoids redundant re-hashing on saves that update other fields
 * (e.g. role or status changes), which would invalidate existing tokens.
 */
authUserSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

// ---------------------
// INSTANCE METHODS
// ---------------------
/**
 * Compares a plaintext candidate password against the stored bcrypt hash.
 *
 * @param {string} candidatePassword - Plaintext password provided during login.
 * @returns {Promise<boolean>} `true` if the passwords match, `false` otherwise.
 *
 * @example
 * // In the auth service — password field must be explicitly selected first:
 * const user = await AuthUser.findOne({ email }).select('+password');
 * const isValid = await user.comparePassword(req.body.password);
 */
authUserSchema.methods.comparePassword = async function comparePassword(
  candidatePassword
) {
  // `this.password` is the stored hash (requires `.select('+password')` upstream)
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Generates a random reset token, hashes it to store in the DB, and sets an expiration.
 *
 * @returns {string} The plaintext, unhashed reset token to be sent to the user via email.
 */
authUserSchema.methods.createPasswordResetToken = function () {
  const crypto = require('crypto');
  
  // 1. Generate a raw random string
  const resetToken = crypto.randomBytes(32).toString('hex');

  // 2. Hash the string using SHA-256 for secure DB storage
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // 3. Set expiration time to 10 minutes from now
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

  // 4. Return the unhashed original string meant to go in the email link
  return resetToken;
};

// ---------------------
// MODEL EXPORT
// ---------------------
const AuthUser = mongoose.model('AuthUser', authUserSchema);

module.exports = AuthUser;
