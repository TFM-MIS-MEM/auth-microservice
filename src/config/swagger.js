const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { getVersion } = require('../utils/versionUtils');
const config = require('../config');

const version = getVersion();

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: config.apiTitle || 'Microservice API',
      version,
      description: config.apiDescription || 'OAS documentation for this Microservice REST API',
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Mounts Swagger UI on the Express app.
 * @param {import('express').Application} app
 */
const setupSwagger = (app) => {
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};

module.exports = { setupSwagger, swaggerSpec };
