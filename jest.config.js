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

  // Trinquete de cobertura: valores medidos con la suite de contrato actual
  // (`pnpm test:coverage`, 26/08/2026). No es un objetivo, es un suelo: sirve
  // para que arreglar `src/` contra la especificación no pueda ir acompañado
  // de una pérdida de cobertura sin que la suite lo diga. Al subir, se sube
  // también este bloque.
  coverageThreshold: {
    global: {
      statements: 46.19,
      branches: 17.21,
      functions: 19.56,
      lines: 48.46,
    },
  },

  verbose: true,
};
