const AppError = require('../utils/AppError');

/**
 * Middleware to validate a request against a Joi schema.
 * @param {Object} schema - Joi schema object (can validate req.body, req.query, req.params)
 */
const validate = (schema) => (req, _res, next) => {
  const validSchema = {};
  const { body, query, params } = schema;
  if (body) validSchema.body = body;
  if (query) validSchema.query = query;
  if (params) validSchema.params = params;

  const objectToValidate = {};
  if (body) objectToValidate.body = req.body;
  if (query) objectToValidate.query = req.query;
  if (params) objectToValidate.params = req.params;

  // We need Joi to validate the object
  // Lazy require to avoid importing if unused, though normally it's at the top.
  const Joi = require('joi');

  const joiSchema = Joi.object(validSchema);
  const { value, error } = joiSchema.validate(objectToValidate, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errorMessage = error.details.map((details) => details.message).join(', ');
    return next(new AppError(`Validation error: ${errorMessage}`, 400));
  }

  // Override req fields with validated (and optionally sanitized/type-casted) values
  if (value.body) req.body = value.body;
  if (value.query) req.query = value.query;
  if (value.params) req.params = value.params;

  return next();
};

module.exports = validate;
