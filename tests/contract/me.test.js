'use strict';

/** Contrato de `getMe` — GET /v1/auth/me. */

const api = require('../support/api');
const db = require('../support/db');

const me = (token) => api.request(api.app).get('/v1/auth/me').set(api.bearer(token));

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
});
