'use strict';

/** Contrato de `forgotPassword` — POST /v1/auth/forgot-password. */

const api = require('../support/api');
const db = require('../support/db');

const forgotPassword = (body) => api.request(api.app).post('/v1/auth/forgot-password').send(body);

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

describe('POST /v1/auth/forgot-password', () => {
  it('202 — acepta la solicitud para un correo registrado', async () => {
    const { email } = await api.createAccount();

    const res = await forgotPassword({ email });

    expect(res.status).toBe(202);
    expect(res).toSatisfyApiSpec();
  });

  it('202 — acepta también un correo desconocido (impide enumerar usuarios)', async () => {
    const res = await forgotPassword({ email: api.uniqueEmail('desconocido') });

    expect(res.status).toBe(202);
    expect(res).toSatisfyApiSpec();
  });

  it('429 — se supera el límite de tasa', async () => {
    const res = await api.burst(() => forgotPassword({ email: api.uniqueEmail('rate') }));

    expect(res.status).toBe(429);
    expect(res).toSatisfyApiSpec();
  });
});
