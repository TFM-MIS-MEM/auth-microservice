'use strict';

const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const AppError = require('../utils/AppError');
const Account = require('../models/account.model');
const config = require('../config');

/**
 * Valida el JWT del canal web e inyecta la cuenta en `req.account`.
 *
 * Comprueba firma, caducidad y existencia de la cuenta —nada más—. En concreto
 * NO rechaza las cuentas suspendidas: el contrato declara operaciones a las que
 * una cuenta suspendida sí debe poder llegar (`GET /v1/auth/me`, para consultar
 * su propio estado) y otras en las que la suspensión es un 403. El control es
 * por operación, no de middleware.
 */
const protect = async (req, _res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Authentication credential is missing', 401, 'UNAUTHORIZED'));
    }

    const decoded = await promisify(jwt.verify)(token, config.jwtSecret);

    const account = await Account.findById(decoded.sub);
    if (!account) {
      return next(
        new AppError('The account this token belongs to no longer exists', 401, 'UNAUTHORIZED'),
      );
    }

    req.account = account;
    return next();
  } catch (err) {
    // Los errores de JWT son credenciales inválidas (401), no fallos del
    // servicio (500).
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401, 'UNAUTHORIZED'));
    }
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token has expired', 401, 'UNAUTHORIZED'));
    }
    return next(err);
  }
};

/**
 * Exige rol `ADMIN`. Se monta siempre después de `protect`: la credencial ya es
 * válida y lo que falta es el permiso, de ahí el 403 y no el 401.
 */
const requireAdmin = (req, _res, next) => {
  if (req.account.role !== 'ADMIN') {
    return next(new AppError('This operation requires the ADMIN role', 403, 'FORBIDDEN'));
  }

  return next();
};

module.exports = { protect, requireAdmin };
