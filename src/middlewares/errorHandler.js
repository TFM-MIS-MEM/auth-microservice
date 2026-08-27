const logger = require('../utils/logger');
const config = require('../config');

/**
 * Códigos por defecto cuando el error no trae uno propio. Mantiene la respuesta
 * conforme al esquema `ErrorReport`, que exige `code` siempre.
 */
const DEFAULT_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMIT_EXCEEDED',
};

/**
 * Manejador global de errores — patrón ERROR REPORT.
 *
 * Devuelve siempre `{ code, message }`, con `details` opcional, tal y como lo
 * declara `components.schemas.ErrorReport` en el contrato.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;

  logger.error(`${statusCode} — ${err.message}`);

  const response = {
    code: err.code || DEFAULT_CODES[statusCode] || 'INTERNAL_ERROR',
    // Un error no operacional es un fallo del servicio: su mensaje puede
    // contener detalles de implementación y no se devuelve al cliente.
    message: err.isOperational ? err.message : 'Internal server error',
  };

  if (err.details) {
    response.details = err.details;
  }

  // La traza sólo en desarrollo: en test ensucia la comparación contra el
  // contrato y en producción es una fuga de información.
  if (!config.isProduction && !config.isTest) {
    response.details = { ...(response.details || {}), stack: err.stack };
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
