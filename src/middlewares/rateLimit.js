'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Limitador de las operaciones de credenciales.
 *
 * Se monta ruta a ruta y no sobre todo `/v1`: sólo `login`, `forgot-password` y
 * `reset-password` declaran `429` en el contrato, y devolverlo en una operación
 * que no lo declara sería una respuesta no conforme. Son además las tres
 * atacables por fuerza bruta desde fuera.
 *
 * El límite general de tasa por plan es responsabilidad de la pasarela
 * (issue I6); éste es sólo la defensa local del servicio.
 */
const credentialRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP, please try again later.',
  },
});

module.exports = { credentialRateLimiter };
