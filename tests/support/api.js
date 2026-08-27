'use strict';

/**
 * Helpers de invocación HTTP para los tests de contrato.
 *
 * Regla de oro de este fichero: sólo lee campos **declarados en la
 * especificación** (`accountId`, `apiKey`, `token`). Nunca los busca en la
 * envoltura que devuelve hoy el código, porque adaptarse a la implementación
 * actual es justo lo que dejaba la suite anterior sin capacidad de detectar
 * desviaciones.
 *
 * Cuando el registro o el login no devuelven lo que el contrato promete, los
 * helpers caen a un valor de relleno en lugar de romper. Así la petición bajo
 * prueba se llega a emitir siempre y el test falla por el contrato —el motivo
 * que interesa— y no por un `TypeError` en la preparación.
 */

const request = require('supertest');
const app = require('../../src/app');

const PASSWORD = 'SuperSecret123!';

/** Relleno usado cuando el contrato no entregó la credencial prometida. */
const MISSING_TOKEN = 'contract-test-missing-token';
const MISSING_API_KEY = 'contract-test-missing-api-key';
const MISSING_ACCOUNT_ID = '000000000000000000000000';

let sequence = 0;
const uniqueEmail = (prefix = 'account') => {
  sequence += 1;
  return `${prefix}-${process.pid}-${sequence}@example.com`;
};

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

/** POST /v1/auth/register */
const register = (body) => request(app).post('/v1/auth/register').send(body);

/** POST /v1/auth/login */
const login = (body) => request(app).post('/v1/auth/login').send(body);

/**
 * Registra una cuenta y devuelve las credenciales que el contrato promete.
 * No afirma nada: la comprobación del contrato pertenece a los tests.
 */
const createAccount = async ({ email = uniqueEmail(), password = PASSWORD } = {}) => {
  const res = await register({ email, password });

  return {
    res,
    email,
    password,
    accountId: res.body?.accountId ?? MISSING_ACCOUNT_ID,
    apiKey: res.body?.apiKey ?? MISSING_API_KEY,
  };
};

/** Registra una cuenta y abre sesión con ella. */
const createAuthenticatedAccount = async (options) => {
  const account = await createAccount(options);
  const res = await login({ email: account.email, password: account.password });

  return { ...account, token: res.body?.token ?? MISSING_TOKEN };
};

/**
 * Repite una petición hasta obtener un 429 o agotar los intentos.
 * Devuelve la última respuesta recibida.
 */
const burst = async (send, attempts = 120) => {
  let res;
  for (let i = 0; i < attempts; i += 1) {
    // Secuencial a propósito: el limitador cuenta peticiones, no concurrencia.
    // eslint-disable-next-line no-await-in-loop
    res = await send();
    if (res.status === 429) return res;
  }
  return res;
};

module.exports = {
  app,
  request,
  PASSWORD,
  MISSING_TOKEN,
  MISSING_API_KEY,
  MISSING_ACCOUNT_ID,
  uniqueEmail,
  bearer,
  register,
  login,
  createAccount,
  createAuthenticatedAccount,
  burst,
};
