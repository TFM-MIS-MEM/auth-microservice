'use strict';

/** Contrato de `resetPassword` — POST /v1/auth/reset-password. */

const api = require('../support/api');
const db = require('../support/db');

const resetPassword = (body) => api.request(api.app).post('/v1/auth/reset-password').send(body);

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

describe('POST /v1/auth/reset-password', () => {
  it('200 — establece la nueva contraseña con un token vigente', async () => {
    const { email } = await api.createAccount();
    const token = await db.plantPasswordResetToken(email);

    const res = await resetPassword({ token, newPassword: 'NuevaClave123!' });

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
  });

  it('400 — el token no existe', async () => {
    const res = await resetPassword({
      token: 'token-inexistente',
      newPassword: 'NuevaClave123!',
    });

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
  });

  it('400 — el token ha caducado', async () => {
    const { email } = await api.createAccount();
    const token = await db.plantPasswordResetToken(email, { expiresInMs: -1000 });

    const res = await resetPassword({ token, newPassword: 'NuevaClave123!' });

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
  });

  it('429 — se supera el límite de tasa', async () => {
    const res = await api.burst(() =>
      resetPassword({ token: 'token-inexistente', newPassword: 'NuevaClave123!' }),
    );

    expect(res.status).toBe(429);
    expect(res).toSatisfyApiSpec();
  });
});
