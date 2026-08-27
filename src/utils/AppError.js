/**
 * Error de aplicación con código de estado HTTP y código de error simbólico.
 *
 * El `code` materializa el patrón ERROR REPORT del contrato: permite distinguir
 * subtipos dentro de un mismo estado HTTP (p. ej. un 403 por cuenta suspendida
 * frente a un 403 por rol insuficiente) sin obligar al cliente a interpretar el
 * texto del mensaje.
 */
class AppError extends Error {
  /**
   * @param {string} message Texto legible, orientado a la persona que depura.
   * @param {number} statusCode Código de estado HTTP.
   * @param {string} code Código simbólico del contrato, en SCREAMING_SNAKE_CASE.
   */
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
