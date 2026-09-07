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

  // Trinquete de cobertura: valores medidos con la suite en verde
  // (`pnpm test:coverage`, 04/09/2026, 103 pruebas). No es un objetivo, es un
  // suelo: sirve para que arreglar `src/` contra la especificación no pueda ir
  // acompañado de una pérdida de cobertura sin que la suite lo diga. Al subir,
  // se sube también este bloque.
  //
  // Se redondea A LA BAJA, al entero inferior de lo medido —88,00 / 75,49 /
  // 87,30 / 88,41—, siguiendo la convención que se fijó en `pricing`. Un
  // trinquete clavado a la centésima salta con cualquier refactor que mueva
  // una línea sin cambiar nada sustantivo, y un suelo que salta por ruido deja
  // de leerse.
  //
  // Excepción en `statements`: lo medido es 88,00 EXACTO, de modo que el
  // entero inferior coincide con la medición y no deja margen ninguno —que es
  // justo lo que la convención quería evitar—. Se baja un punto más, a 87. La
  // regla es «entero inferior», y cuando la medición ya cae en un entero, el
  // inferior es el anterior.
  //
  // Historial de la medición:
  //   - 46,19 / 17,21 / 19,56 / 48,46 — con los 42 tests en rojo: la mayor
  //     parte de `src/` no llegaba a ejecutarse porque las peticiones morían
  //     en un 404 de enrutado.
  //   - 87,13 / 69,67 / 85,71 / 87,50 — 27/08/2026, con las 69 de contrato.
  //   - 88,00 / 75,49 / 87,30 / 88,41 — 04/09/2026, al cerrar #79; fijado a
  //     87 / 75 / 87 / 88. La subida de las ramas
  //     es casi toda de `errorHandler.js`, que pasa a 100 % en las cuatro
  //     métricas: la prueba unitaria recorre sus dos ramas —error operacional
  //     y no operacional— y el vocabulario de códigos por defecto al completo.
  //
  // Por qué las ramas siguen por debajo del resto, y por qué se acepta:
  // las que quedan sin cubrir NO son lógica del contrato —la del contrato se
  // cubrió al completo el 27/08/2026: suspensión en `login`, secreto interno
  // ausente y no coincidente en `validate-key`, JWT caducado, y JWT de una
  // cuenta ya eliminada—. Son caminos defensivos y de entorno:
  //
  //   - `src/config/index.js` y `src/utils/logger.js`: valores por defecto de
  //     variables de entorno y niveles de registro silenciados en pruebas.
  //     (`src/config/jwtExpiry.js` sí se prueba: la vigencia del JWT es una
  //     regla documentada, no un valor por defecto — véase tests/unit.)
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
      statements: 87,
      branches: 75,
      functions: 87,
      lines: 88,
    },
  },

  verbose: true,
};
