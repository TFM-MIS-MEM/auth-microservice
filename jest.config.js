/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],

  // La suite anterior fijaba un contrato obsoleto. Se conserva como material
  // para la memoria (véase tests/legacy/README.md), pero no se ejecuta.
  testPathIgnorePatterns: ['/node_modules/', '/tests/legacy/'],

  // Un único MongoDB en memoria para toda la ejecución.
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',

  // Registra el matcher toSatisfyApiSpec contra openapi/auth.yaml.
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],

  // Trinquete de cobertura: valores medidos con la suite de contrato en verde
  // (`pnpm test:coverage`, 27/08/2026). No es un objetivo, es un suelo: sirve
  // para que arreglar `src/` contra la especificación no pueda ir acompañado
  // de una pérdida de cobertura sin que la suite lo diga. Al subir, se sube
  // también este bloque.
  //
  // Los valores anteriores (46,19 / 17,21 / 19,56 / 48,46) se midieron con los
  // 42 tests en rojo: la mayor parte de `src/` no llegaba a ejecutarse porque
  // las peticiones morían en un 404 de enrutado.
  //
  // Por qué las ramas van 20 puntos por debajo del resto, y por qué se acepta:
  // las que quedan sin cubrir NO son lógica del contrato —la del contrato se
  // cubrió al completo el 27/08/2026: suspensión en `login`, secreto interno
  // ausente y no coincidente en `validate-key`, JWT caducado, y JWT de una
  // cuenta ya eliminada—. Son caminos defensivos y de entorno:
  //
  //   - `src/config/index.js` y `src/utils/logger.js`: valores por defecto de
  //     variables de entorno y niveles de registro silenciados en pruebas.
  //   - `src/middlewares/errorHandler.js`: la rama del error no operacional
  //     (500) y la traza que sólo se añade en desarrollo.
  //   - `src/middlewares/validate.js`: las ramas de `query`, que ningún
  //     esquema del servicio usa todavía.
  //   - `src/services/auth.service.js`: las comprobaciones `if (!account)`
  //     posteriores a `protect`, que ya cargó la cuenta, y la guarda de
  //     `jwtSecret` sin configurar.
  //   - `src/services/email.service.js` y `src/config/swagger.js`: el camino
  //     real de Resend y el fallo de lectura de la especificación.
  //   - `src/app.js` y `src/controllers/health.controller.js`: montaje de
  //     `/docs`, `morgan` fuera de pruebas y el estado de la conexión a Mongo.
  //     `/docs` y `/openapi.json` se verificaron contra el servicio levantado.
  //
  // Cubrirlas exigiría tests que no comprueban ninguna promesa de la API.
  coverageThreshold: {
    global: {
      statements: 86.44,
      branches: 66.9,
      functions: 85.24,
      lines: 86.84,
    },
  },

  verbose: true,
};
