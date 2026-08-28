'use strict';

/** Contrato de `getMe` — GET /v1/auth/me. */

const jwt = require('jsonwebtoken');
const api = require('../support/api');
const db = require('../support/db');

const me = (token) => api.request(api.app).get('/v1/auth/me').set(api.bearer(token));

/**
 * Firma un JWT ya caducado para la cuenta indicada.
 *
 * Concesión deliberada, como las de `tests/support/db.js`: la caducidad es de
 * 60 minutos y no hay ninguna operación publicada que permita adelantar el
 * reloj, de modo que el token expirado no es alcanzable sólo con el contrato.
 * Queda confinada aquí, y de paso fija el claim del sujeto: la pasarela lee
 * `sub` para poblar `X-Account-Id`.
 */
const expiredToken = (accountId) =>
  jwt.sign({ role: 'CUSTOMER' }, process.env.JWT_SECRET, {
    subject: accountId,
    expiresIn: '-1s',
    issuer: 'auth-microservice',
  });

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

describe('GET /v1/auth/me', () => {
  it('200 — devuelve la cuenta autenticada', async () => {
    const { token } = await api.createAuthenticatedAccount();

    const res = await me(token);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — sin credencial', async () => {
    const res = await api.request(api.app).get('/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — con un JWT que no verifica', async () => {
    const res = await me('no.es.un.jwt');

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — con un JWT caducado', async () => {
    const { accountId } = await api.createAccount();

    const res = await me(expiredToken(accountId));

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('200 — una cuenta suspendida puede consultar su propio estado', async () => {
    // El control de estado es por operación y no en el middleware: `me` sólo
    // declara 200 y 401, así que una cuenta suspendida tiene que poder llegar
    // aquí para enterarse de que lo está.
    const { token, email } = await api.createAuthenticatedAccount();
    await db.patchAccountDocument(email, { status: 'suspended' });

    const res = await me(token);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('suspended');
    expect(res).toSatisfyApiSpec();
  });
});
