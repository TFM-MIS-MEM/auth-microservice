'use strict';

const { Router } = require('express');
const Joi = require('joi');
const { 
  registerUser, 
  loginUser,
  forgotPassword,
  resetPassword,
  changePassword,
  rotateApiKey
} = require('../controllers/auth.controller');
const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');

const router = Router();

// ---------------------
// JOI VALIDATION SCHEMAS
// ---------------------

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         password:
 *           type: string
 *           minLength: 8
 *           example: "SuperSecret123!"
 *         role:
 *           type: string
 *           enum: [user, admin, researcher]
 *           default: user
 *           example: "user"
 *     RegisterResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         message:
 *           type: string
 *           example: "User registered successfully. Store your API Key — it will not be shown again."
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/AuthUser'
 *             apiKey:
 *               type: string
 *               description: Plaintext API Key. Shown only once — store it securely.
 *               example: "a3f1c2d4e5b6..."
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         password:
 *           type: string
 *           example: "SuperSecret123!"
 *     LoginResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         message:
 *           type: string
 *           example: "Login successful."
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/AuthUser'
 *             token:
 *               type: string
 *               description: Signed JWT. Include as Bearer token in Authorization header.
 *               example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 */

const registerSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().min(8).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'any.required': 'Password is required',
    }),
    role: Joi.string().valid('user', 'admin', 'researcher').default('user'),
  }),
};

const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required',
    }),
  }),
};

/**
 * @swagger
 * components:
 *   schemas:
 *     ForgotPasswordRequest:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *     ResetPasswordRequest:
 *       type: object
 *       required:
 *         - token
 *         - password
 *       properties:
 *         token:
 *           type: string
 *           description: The token received in the email link
 *         password:
 *           type: string
 *           description: The new password (min. 8 characters)
 *           minLength: 8
 *     ChangePasswordRequest:
 *       type: object
 *       required:
 *         - oldPassword
 *         - newPassword
 *       properties:
 *         oldPassword:
 *           type: string
 *         newPassword:
 *           type: string
 *           minLength: 8
 *     RotateApiKeyResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             apiKey:
 *               type: string
 */
const forgotPasswordSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
  }),
};

const resetPasswordSchema = {
  body: Joi.object({
    token: Joi.string().required(),
    password: Joi.string().min(8).required(),
  }),
};

const changePasswordSchema = {
  body: Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
  }),
};

// ---------------------
// ROUTES — Semantic Versioning handled by parent router (/api/v1/auth)
// ---------------------

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register a new user
 *     description: >
 *       Creates a new user account and returns a one-time plaintext API Key.
 *       The API Key is hashed before storage and **cannot be recovered** after this response.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully. API Key shown only once.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegisterResponse'
 *       400:
 *         description: Validation error (missing or malformed fields).
 *       409:
 *         description: Email already registered.
 *       500:
 *         description: Internal server error.
 */
router.post('/register', validate(registerSchema), registerUser);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Log in and obtain a JWT
 *     description: >
 *       Validates user credentials and returns a signed JWT for subsequent
 *       authenticated requests. The token contains id, email and role claims.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful. Returns a signed JWT.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Validation error (missing or malformed fields).
 *       401:
 *         description: Invalid email or password.
 *       403:
 *         description: Account is inactive or suspended.
 *       500:
 *         description: Internal server error.
 */
router.post('/login', validate(loginSchema), loginUser);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     tags:
 *       - Auth - Credential Recovery
 *     summary: Request password reset link
 *     description: Sends an email with a reset token if the email exists.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: Email sent successfully.
 *       404:
 *         description: There is no account associated with this email address.
 */
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     tags:
 *       - Auth - Credential Recovery
 *     summary: Reset password via token
 *     description: Replaces the forgotten password using the emailed token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset successful.
 *       400:
 *         description: Invalid or expired token.
 */
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     tags:
 *       - Auth - Internal Accounts
 *     summary: Change known password
 *     description: Updates the password of an authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password changed successfully.
 *       401:
 *         description: Unauthorized - Old password incorrect or missing token.
 */
router.post('/change-password', protect, validate(changePasswordSchema), changePassword);

/**
 * @swagger
 * /api/v1/auth/rotate-api-key:
 *   post:
 *     tags:
 *       - Auth - Internal Accounts
 *     summary: Rotate master API Key
 *     description: Generates a new API Key for the authenticated user and revokes the old one.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: API Key rotated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RotateApiKeyResponse'
 *       401:
 *         description: Unauthorized.
 */
router.post('/rotate-api-key', protect, rotateApiKey);

module.exports = router;
