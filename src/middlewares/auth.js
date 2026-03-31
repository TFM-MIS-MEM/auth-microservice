'use strict';

const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const AppError = require('../utils/AppError');
const AuthUser = require('../models/user.model');
const config = require('../config');

/**
 * Protects routes by validating the Bearer JWT token.
 * Validates token signature, expiration, user existence, and account status.
 * Injects the authenticated user object into `req.user`.
 */
const protect = async (req, res, next) => {
  try {
    // 1. Get token from formatting "Bearer <token>"
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(
        new AppError('You are not logged in! Please log in to get access.', 401)
      );
    }

    // 2. Validate token signature and expiration
    const decoded = await promisify(jwt.verify)(token, config.jwtSecret);

    // 3. Verify user still exists
    const currentUser = await AuthUser.findById(decoded.id);
    if (!currentUser) {
      return next(
        new AppError('The user belonging to this token no longer exists.', 401)
      );
    }

    // 4. Verify account is not suspended
    if (currentUser.status !== 'active') {
      return next(new AppError('This account is suspended or inactive.', 403));
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    next();
  } catch (err) {
    // Handle JWT specific errors cleanly so they return 401s instead of 500s
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again!', 401));
    }
    if (err.name === 'TokenExpiredError') {
      return next(
        new AppError('Your token has expired! Please log in again.', 401)
      );
    }
    next(err);
  }
};

module.exports = { protect };
