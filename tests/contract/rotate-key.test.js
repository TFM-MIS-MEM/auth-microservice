'use strict';

/** Contrato de `rotateKey` — POST /v1/auth/rotate-key. */

const api = require('../support/api');
const db = require('../support/db');

const rotateKey = (token, body) =>
  api.request(api.app).post('/v1/auth/rotate-key').set(api.bearer(token)).send(body);

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

describe('POST /v1/auth/rotate-key', () => {
  it('201 — emite una API KEY nueva', async () => {
    const { token, password } = await api.createAuthenticatedAccount();

    const res = await rotateKey(token, { password });

    expect(res.status).toBe(201);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — sin credencial', async () => {
    const res = await api
      .request(api.app)
      .post('/v1/auth/rotate-key')
      .send({ password: api.PASSWORD });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — la contraseña de confirmación no es correcta', async () => {
    const { token } = await api.createAuthenticatedAccount();

    const res = await rotateKey(token, { password: 'ContraseñaEquivocada1!' });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('403 — la cuenta está suspendida (credencial válida, sin permiso)', async () => {
    const { token, password, email } = await api.createAuthenticatedAccount();
    await db.patchAccountDocument(email, { status: 'suspended' });

    const res = await rotateKey(token, { password });

    expect(res.status).toBe(403);
    expect(res).toSatisfyApiSpec();
  });
});
