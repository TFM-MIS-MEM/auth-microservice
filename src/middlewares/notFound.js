const AppError = require('../utils/AppError');

/**
 * Captura toda petición que no case con ninguna ruta declarada.
 */
const notFound = (req, _res, next) => {
  next(new AppError(`Resource not found: ${req.originalUrl}`, 404, 'NOT_FOUND'));
};

module.exports = notFound;
