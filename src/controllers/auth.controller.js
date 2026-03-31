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

// ---------------------
// POST /api/v1/auth/forgot-password
// ---------------------
const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  
  await authService.forgotPassword(email);
  
  res.status(200).json({
    status: 'success',
    message: 'A password reset link has been sent to your email.',
  });
});

// ---------------------
// POST /api/v1/auth/reset-password
// ---------------------
const resetPassword = catchAsync(async (req, res) => {
  const { token, password } = req.body;
  
  await authService.resetPassword(token, password);
  
  res.status(200).json({
    status: 'success',
    message: 'Password has been successfully reset. You can now log in.',
  });
});

// ---------------------
// POST /api/v1/auth/change-password
// ---------------------
const changePassword = catchAsync(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  
  await authService.changePassword(req.user.id, oldPassword, newPassword);
  
  res.status(200).json({
    status: 'success',
    message: 'Password has been successfully changed.',
  });
});

// ---------------------
// POST /api/v1/auth/rotate-api-key
// ---------------------
const rotateApiKey = catchAsync(async (req, res) => {
  // protect middleware injects req.user
  const newApiKey = await authService.rotateApiKey(req.user.id);
  
  res.status(200).json({
    status: 'success',
    message: 'API Key rotated successfully. Store your new key securely.',
    data: {
      apiKey: newApiKey,
    },
  });
});

// ---------------------
// GET /api/v1/auth/me
// ---------------------
const getMe = catchAsync(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

// ---------------------
// DELETE /api/v1/auth/account
// ---------------------
const deleteAccount = catchAsync(async (req, res) => {
  await authService.deleteAccount(req.user.id);
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

module.exports = { 
  registerUser, 
  loginUser, 
  forgotPassword, 
  resetPassword, 
  changePassword, 
  rotateApiKey,
  getMe,
  deleteAccount
};
