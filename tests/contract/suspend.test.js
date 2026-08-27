'use strict';

/** Contrato de `suspendOwnAccount` — POST /v1/auth/suspend. */

const api = require('../support/api');
const db = require('../support/db');

const suspend = (token) => api.request(api.app).post('/v1/auth/suspend').set(api.bearer(token));

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

describe('POST /v1/auth/suspend', () => {
  it('200 — suspende la cuenta del solicitante', async () => {
    const { token } = await api.createAuthenticatedAccount();

    const res = await suspend(token);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — sin credencial', async () => {
    const res = await api.request(api.app).post('/v1/auth/suspend');

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('409 — la cuenta ya se encuentra suspendida', async () => {
    const { token } = await api.createAuthenticatedAccount();
    await suspend(token);

    const res = await suspend(token);

    expect(res.status).toBe(409);
    expect(res).toSatisfyApiSpec();
  });
});
