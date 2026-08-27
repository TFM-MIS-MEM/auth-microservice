'use strict';

/** Contrato de `changePassword` — POST /v1/auth/change-password. */

const api = require('../support/api');
const db = require('../support/db');

const changePassword = (token, body) =>
  api.request(api.app).post('/v1/auth/change-password').set(api.bearer(token)).send(body);

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

describe('POST /v1/auth/change-password', () => {
  it('200 — cambia la contraseña de la cuenta autenticada', async () => {
    const { token, password } = await api.createAuthenticatedAccount();

    const res = await changePassword(token, {
      oldPassword: password,
      newPassword: 'NuevaClave123!',
    });

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
  });

  it('400 — la nueva contraseña no alcanza el mínimo declarado', async () => {
    const { token, password } = await api.createAuthenticatedAccount();

    const res = await changePassword(token, {
      oldPassword: password,
      newPassword: 'corta',
    });

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — sin credencial', async () => {
    const res = await api.request(api.app).post('/v1/auth/change-password').send({
      oldPassword: api.PASSWORD,
      newPassword: 'NuevaClave123!',
    });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — la contraseña anterior no es correcta', async () => {
    const { token } = await api.createAuthenticatedAccount();

    const res = await changePassword(token, {
      oldPassword: 'ContraseñaEquivocada1!',
      newPassword: 'NuevaClave123!',
    });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });
});
