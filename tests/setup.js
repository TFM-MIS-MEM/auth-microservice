'use strict';

/**
 * Jest setup — se ejecuta ANTES de cada fichero de test (setupFilesAfterEnv).
 *
 * Hace dos cosas:
 *
 *  1. Fija el entorno de ejecución antes de que `src/config` lea `.env`
 *     (dotenv nunca sobrescribe una variable ya presente en `process.env`,
 *     de modo que lo definido aquí gana). Esto evita que la suite toque
 *     servicios externos reales: en particular, la clave de Resend es falsa,
 *     así que ningún test puede enviar correo de verdad.
 *
 *  2. Registra el matcher `toSatisfyApiSpec` contra `openapi/auth.yaml`.
 *     A partir de aquí, la especificación —y no el código— es la que decide
 *     si una respuesta es correcta: el contrato NO se reescribe en los tests.
 */

const path = require('path');
const jestOpenAPI = require('jest-openapi').default;

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'contract-tests-secret-do-not-use-in-production';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '60m';
process.env.RESEND_API_KEY = 're_contract_tests_fake_key';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.INTERNAL_API_SECRET =
  process.env.INTERNAL_API_SECRET || 'contract-tests-internal-secret';

jestOpenAPI(path.resolve(__dirname, '..', 'openapi', 'auth.yaml'));
