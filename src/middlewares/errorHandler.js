const logger = require('../utils/logger');
const config = require('../config');

/**
 * Global Error Handler Middleware — Error Report Pattern.
 *
 * Returns a consistent JSON error response:
 * { status, message, details? }
 *
 * In development mode, also includes the error stack trace.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  logger.error(`${statusCode} — ${err.message}`);

  const response = {
    status,
    message: err.isOperational ? err.message : 'Internal server error',
  };

  // Include stack trace in non-production environments
  if (!config.isProduction) {
    response.stack = err.stack;
  }

  // Include validation details if present
  if (err.details) {
    response.details = err.details;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
