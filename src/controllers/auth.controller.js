'use strict';

const authService = require('../services/auth.service');

// ---------------------
// HELPER — Async wrapper to forward errors to Express error handler
// ---------------------
const catchAsync = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------------------
// POST /api/v1/auth/register  — State Creation Operation
// ---------------------

const registerUser = catchAsync(async (req, res) => {
  const { email, password, role } = req.body;

  const { user, apiKey } = await authService.register({ email, password, role });

  res.status(201).json({
    status: 'success',
    message: 'User registered successfully. Store your API Key — it will not be shown again.',
    data: {
      user,
      apiKey, // Plaintext — one-time display only
    },
  });
});

// ---------------------
// POST /api/v1/auth/login  — Computation Function
// ---------------------

const loginUser = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const { user, token } = await authService.login({ email, password });

  res.status(200).json({
    status: 'success',
    message: 'Login successful.',
    data: {
      user,
      token,
    },
  });
});

module.exports = { registerUser, loginUser };
