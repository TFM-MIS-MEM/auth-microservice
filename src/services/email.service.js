'use strict';

const { Resend } = require('resend');
const config = require('../config');
const logger = require('../utils/logger');

const resend = new Resend(config.resendApiKey);

const FROM_ADDRESS = 'TFM SaaS Auth <onboarding@resend.dev>';

/**
 * Envía el enlace de recuperación de contraseña.
 *
 * En el entorno de pruebas no se emite ninguna petición de red: la clave de
 * Resend es falsa, pero el SDK intentaría contactar con `api.resend.com` de
 * todas formas y la suite quedaría a merced de la red.
 *
 * @param {string} email Destinatario.
 * @param {string} token Token de recuperación en claro.
 * @returns {Promise<void>}
 * @throws {Error} Si el proveedor rechaza el envío. Quien llama decide si el
 *   fallo debe llegar al cliente; en `forgotPassword` no debe, porque la
 *   respuesta es uniforme por diseño.
 */
const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;

  if (config.isTest) {
    logger.debug(`[test] password reset email suppressed for ${email}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
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
    throw new Error(`Resend rejected the message: ${error.message}`);
  }
};

module.exports = { sendPasswordResetEmail };
