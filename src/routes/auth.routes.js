'use strict';

const { Router } = require('express');
const Joi = require('joi');
const { registerUser, loginUser } = require('../controllers/auth.controller');
const validate = require('../middlewares/validate');

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

module.exports = router;
