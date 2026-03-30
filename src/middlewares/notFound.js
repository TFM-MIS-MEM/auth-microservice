const AppError = require('../utils/AppError');

/**
 * 404 Not Found handler.
 * Catches any request that didn't match a defined route.
 */
const notFound = (req, _res, next) => {
  next(new AppError(`Resource not found: ${req.originalUrl}`, 404));
};

module.exports = notFound;
