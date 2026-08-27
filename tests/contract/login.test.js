'use strict';

/** Contrato de `login` — POST /v1/auth/login. */

const api = require('../support/api');
const db = require('../support/db');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

describe('POST /v1/auth/login', () => {
  it('200 — devuelve el JWT y su vigencia', async () => {
    const { email, password } = await api.createAccount();

    const res = await api.login({ email, password });

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — contraseña incorrecta', async () => {
    const { email } = await api.createAccount();

    const res = await api.login({ email, password: 'ContraseñaEquivocada1!' });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('429 — se supera el límite de tasa', async () => {
    const res = await api.burst(() =>
      api.login({ email: api.uniqueEmail('rate'), password: api.PASSWORD }),
    );

    expect(res.status).toBe(429);
    expect(res).toSatisfyApiSpec();
  });
});
