'use strict';

const AppError = require('../utils/AppError');
const config = require('../config');

/**
 * Restringe una operación a los componentes internos de la plataforma.
 *
 * El contrato declara `internalSecret` junto a `apiKeyAuth` en el mismo objeto
 * de seguridad de `POST /v1/auth/validate-key`: hacen falta las dos
 * credenciales a la vez. El aislamiento de red es la protección principal, pero
 * en un despliegue con `docker-compose` todos los servicios comparten red, de
 * modo que sin este secreto cualquier contenedor podría interrogar un endpoint
 * que valida credenciales.
 *
 * Responde 401 tanto si la cabecera falta como si no coincide: el contrato no
 * declara 403 en esta operación, y distinguir ambos casos sólo ayudaría a quien
 * esté probando secretos a ciegas.
 */
const requireInternalSecret = (req, _res, next) => {
  const incomingSecret = req.headers['x-internal-secret'];

  if (!incomingSecret || incomingSecret !== config.internalApiSecret) {
    return next(new AppError('Invalid or missing internal secret', 401, 'UNAUTHORIZED'));
  }

  return next();
};

module.exports = { requireInternalSecret };
