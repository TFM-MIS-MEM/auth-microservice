'use strict';

const authService = require('../services/auth.service');

/** Envuelve un manejador asíncrono para que sus rechazos lleguen a Express. */
const catchAsync = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Varias respuestas del contrato se declaran sin `content`. Se cierran con
 * `end()` y no con `json()`: enviar un cuerpo donde el contrato no declara
 * ninguno es una desviación, y la suite lo detecta.
 */
const noContent = (res, statusCode) => res.status(statusCode).end();

// POST /v1/auth/register
const registerAccount = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const account = await authService.register({ email, password });

  res.status(201).json(account);
});

// POST /v1/auth/login
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const session = await authService.login({ email, password });

  res.status(200).json(session);
});

// POST /v1/auth/forgot-password
const forgotPassword = catchAsync(async (req, res) => {
  await authService.forgotPassword(req.body.email);

  // 202 exista o no la cuenta: la respuesta no puede revelar cuál es el caso.
  noContent(res, 202);
});

// POST /v1/auth/reset-password
const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.newPassword);

  noContent(res, 200);
});

// POST /v1/auth/change-password
const changePassword = catchAsync(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  await authService.changePassword(req.account.id, oldPassword, newPassword);

  noContent(res, 200);
});

// POST /v1/auth/rotate-key
const rotateKey = catchAsync(async (req, res) => {
  const apiKey = await authService.rotateKey(req.account.id, req.body.password);

  res.status(201).json({ apiKey });
});

// GET /v1/auth/me
const getMe = catchAsync(async (req, res) => {
  const account = await authService.getAccount(req.account.id);

  res.status(200).json(account);
});

// POST /v1/auth/suspend
const suspendOwnAccount = catchAsync(async (req, res) => {
  await authService.suspendOwnAccount(req.account.id);

  noContent(res, 200);
});

// PATCH /v1/auth/accounts/{accountId}/status
const setAccountStatus = catchAsync(async (req, res) => {
  await authService.setAccountStatus(req.params.accountId, req.body.status);

  noContent(res, 200);
});

// DELETE /v1/auth/account
const deleteAccount = catchAsync(async (req, res) => {
  await authService.deleteAccount(req.account.id, req.body.password);

  noContent(res, 204);
});

// POST /v1/auth/validate-key
const validateKey = catchAsync(async (req, res) => {
  // La clave viaja en cabecera: en el cuerpo acabaría en las trazas de morgan.
  const verdict = await authService.validateKey(req.headers['x-api-key']);

  res.status(200).json(verdict);
});

module.exports = {
  registerAccount,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  rotateKey,
  getMe,
  suspendOwnAccount,
  setAccountStatus,
  deleteAccount,
  validateKey,
};
