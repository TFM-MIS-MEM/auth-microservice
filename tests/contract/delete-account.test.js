'use strict';

/** Contrato de `deleteAccount` — DELETE /v1/auth/account. */

const api = require('../support/api');
const db = require('../support/db');

const deleteAccount = (token, body) => {
  const req = api.request(api.app).delete('/v1/auth/account');

  if (token) req.set(api.bearer(token));

  return req.send(body);
};

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

describe('DELETE /v1/auth/account', () => {
  it('204 — elimina la cuenta del solicitante', async () => {
    const { token, password } = await api.createAuthenticatedAccount();

    const res = await deleteAccount(token, { password });

    expect(res.status).toBe(204);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — sin credencial', async () => {
    const res = await deleteAccount(null, { password: api.PASSWORD });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — la contraseña de confirmación no es correcta', async () => {
    const { token } = await api.createAuthenticatedAccount();

    const res = await deleteAccount(token, {
      password: 'ContraseñaEquivocada1!',
    });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — el JWT deja de servir en cuanto la cuenta se ha eliminado', async () => {
    // El token sigue verificando por firma: lo que lo invalida es que la cuenta
    // a la que apunta ya no existe. Sin esta comprobación, el borrado del RGPD
    // no surtiría efecto hasta que caducase el token.
    const { token, password } = await api.createAuthenticatedAccount();
    await deleteAccount(token, { password });

    const res = await api.request(api.app).get('/v1/auth/me').set(api.bearer(token));

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('403 — la cuenta está suspendida (credencial válida, sin permiso)', async () => {
    const { token, password, email } = await api.createAuthenticatedAccount();
    await db.patchAccountDocument(email, { status: 'suspended' });

    const res = await deleteAccount(token, { password });

    expect(res.status).toBe(403);
    expect(res).toSatisfyApiSpec();
  });
});
