'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');
const logger = require('../utils/logger');

const SPEC_PATH = path.resolve(__dirname, '..', '..', 'openapi', 'auth.yaml');

/**
 * Carga la especificación desde `openapi/auth.yaml`.
 *
 * La documentación se sirve desde el mismo fichero que valida la suite de
 * contrato, en lugar de generarse a partir de anotaciones en el código. Así no
 * existe una segunda descripción de la API que pueda divergir de la primera: si
 * la documentación miente, los tests fallan.
 *
 * @returns {object|null} La especificación, o `null` si no puede leerse.
 */
const loadSpec = () => {
  try {
    return yaml.load(fs.readFileSync(SPEC_PATH, 'utf8'));
  } catch (err) {
    logger.error(`OpenAPI specification could not be loaded from ${SPEC_PATH}: ${err.message}`);
    return null;
  }
};

const swaggerSpec = loadSpec();

/**
 * Publica la especificación en `/openapi.json` y la interfaz en `/docs`.
 *
 * Ambas rutas quedan fuera de `/v1`: no forman parte de la API versionada.
 *
 * @param {import('express').Application} app
 */
const setupSwagger = (app) => {
  if (!swaggerSpec) return;

  app.get('/openapi.json', (_req, res) => res.status(200).json(swaggerSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};

module.exports = { setupSwagger, swaggerSpec };
