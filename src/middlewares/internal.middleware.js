'use strict';

const AppError = require('../utils/AppError');
const config = require('../config');

/**
 * Middleware for restricting access to internal M2M routes.
 * Checks for a specific header 'x-internal-secret' matching the configured secret.
 */
const requireInternalSecret = (req, res, next) => {
  const incomingSecret = req.headers['x-internal-secret'];

  if (!incomingSecret) {
    return next(new AppError('Missing x-internal-secret header', 401));
  }

  if (incomingSecret !== config.internalApiSecret) {
    return next(new AppError('Invalid x-internal-secret header', 403));
  }

  next();
};

module.exports = {
  requireInternalSecret,
};
