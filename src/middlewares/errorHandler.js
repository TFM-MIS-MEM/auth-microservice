const logger = require('../utils/logger');

/**
 * Vocabulario de códigos por defecto, para los errores que no traen uno propio.
 *
 * `ErrorReport` declara `code` como cadena libre, de modo que la especificación
 * NO puede fijar este vocabulario y ningún test de contrato lo protege: si aquí
 * se escribiera `UNAUTHORISED` en lugar de `UNAUTHORIZED`, la suite seguiría en
 * verde y el cliente se rompería. Por eso la lista se elige una vez, se escribe
 * aquí y se mantiene igual en todos los servicios. Se fija además en
 * `tests/unit/error-handler.test.js`.
 *
 * Los códigos específicos del dominio se pasan al construir el `AppError`, no se
 * derivan del estado:
 *
 *   - `EMAIL_ALREADY_REGISTERED`  (409) — el correo ya tiene cuenta.
 *   - `ACCOUNT_ALREADY_SUSPENDED` (409) — la cuenta ya estaba suspendida.
 *   - `ACCOUNT_SUSPENDED`         (403) — la cuenta no puede operar.
 *   - `ACCOUNT_NOT_FOUND`         (404) — la cuenta ajena indicada no existe.
 *   - `INVALID_RESET_TOKEN`       (400) — el token de recuperación no vale.
 *   - `INVALID_API_KEY`           (401) — la clave no corresponde a ninguna cuenta.
 *
 * Los de CLAUDE.md §6 que no aparecen aquí —`QUOTA_EXCEEDED`,
 * `GALLERY_FROZEN_MODEL_NOT_IN_PLAN`, `MODEL_NOT_IN_PLAN`, `FEATURE_NOT_IN_PLAN`—
 * pertenecen a `fr-commercial` y no se declaran en este servicio.
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
 * declara `components.schemas.ErrorReport` en el contrato. El tipo de contenido
 * es `application/json`, que es el que la especificación declara para
 * `ErrorReport`: NO se emite `application/problem+json`.
 *
 * La traza de pila NO viaja en el cuerpo en ningún entorno. Va al registro, que
 * es donde puede leerla quien opera el servicio y nadie más. La versión anterior
 * la incluía bajo `if (!config.isProduction && !config.isTest)`, de modo que se
 * emitía en desarrollo con rutas absolutas del contenedor y —por la disposición
 * de pnpm, que codifica la versión en la ruta— las versiones exactas de las
 * dependencias. Bastaba con repetir un login fallido para obtenerlas, sin
 * credencial y a través de la pasarela, que no filtra el cuerpo (#79).
 *
 * Que la traza saliera sólo fuera de producción tampoco la hacía inocua: el
 * entorno de desarrollo se comparte, se graba en capturas y acaba pegado en
 * incidencias. Y dos servicios detrás de la misma pasarela respondían distinto
 * al mismo error, diferencia que el cliente no puede explicarse.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;

  logger.error(`${statusCode} — ${err.message}`);
  // La traza, sólo al registro y sólo cuando aporta: un error operacional es un
  // camino previsto del contrato, no un fallo que haya que depurar.
  if (!err.isOperational) {
    logger.error(err.stack);
  }

  const response = {
    code: err.code || DEFAULT_CODES[statusCode] || 'INTERNAL_ERROR',
    // Un error no operacional es un fallo del servicio: su mensaje puede
    // contener detalles de implementación y no se devuelve al cliente.
    message: err.isOperational ? err.message : 'Internal server error',
  };

  if (err.details) {
    response.details = err.details;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
