'use strict';

/**
 * Rutas del servicio de autenticación.
 *
 * El contrato de cada operación —cuerpos, respuestas y códigos— vive en
 * `openapi/auth.yaml` y no se duplica aquí en anotaciones: dos descripciones de
 * lo mismo divergen en cuanto una se mueve.
 */

const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/auth.controller');
const validate = require('../middlewares/validate');
const { protect, requireAdmin } = require('../middlewares/auth');
const { requireInternalSecret } = require('../middlewares/internal.middleware');
const { credentialRateLimiter } = require('../middlewares/rateLimit');

const router = Router();

// ---------------------
// ESQUEMAS DE VALIDACIÓN
// ---------------------

/**
 * `role` NO figura aquí a propósito. Con `stripUnknown` activo, enviarlo no es
 * un error: se descarta en silencio y el servicio asigna siempre `CUSTOMER`.
 */
const registerSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
  }),
};

const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
};

const forgotPasswordSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
  }),
};

const resetPasswordSchema = {
  body: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
  }),
};

const changePasswordSchema = {
  body: Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
  }),
};

const setAccountStatusSchema = {
  params: Joi.object({
    accountId: Joi.string().required(),
  }),
  body: Joi.object({
    status: Joi.string().valid('active', 'suspended').required(),
  }),
};

// ---------------------
// RUTAS — el prefijo /v1/auth lo monta el enrutador padre
// ---------------------

router.post('/register', validate(registerSchema), controller.registerAccount);

router.post('/login', credentialRateLimiter, validate(loginSchema), controller.login);

router.post(
  '/forgot-password',
  credentialRateLimiter,
  validate(forgotPasswordSchema),
  controller.forgotPassword,
);

router.post(
  '/reset-password',
  credentialRateLimiter,
  validate(resetPasswordSchema),
  controller.resetPassword,
);

router.post('/change-password', protect, validate(changePasswordSchema), controller.changePassword);

/**
 * Sin validación de cuerpo: el contrato no declara 400 en esta operación, así
 * que una contraseña de confirmación ausente se trata como una confirmación
 * incorrecta (401) y no como una petición mal formada.
 */
router.post('/rotate-key', protect, controller.rotateKey);

router.get('/me', protect, controller.getMe);

router.post('/suspend', protect, controller.suspendOwnAccount);

router.patch(
  '/accounts/:accountId/status',
  protect,
  requireAdmin,
  validate(setAccountStatusSchema),
  controller.setAccountStatus,
);

// Mismo criterio que en `rotate-key` respecto a la contraseña de confirmación.
router.delete('/account', protect, controller.deleteAccount);

/**
 * Operación interna: exige la API KEY a validar y, además, el secreto
 * compartido que acredita al llamante como componente de la plataforma.
 */
router.post('/validate-key', requireInternalSecret, controller.validateKey);

module.exports = router;
