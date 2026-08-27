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
  coverageThreshold: {
    global: {
      statements: 85.28,
      branches: 63.3,
      functions: 85.24,
      lines: 85.6,
    },
  },

  verbose: true,
};
