'use strict';

/**
 * Contrato de `register` — POST /v1/auth/register.
 *
 * La forma de la respuesta la comprueba `toSatisfyApiSpec()` contra
 * `openapi/auth.yaml`. Aquí sólo se elige qué respuesta declarada se ejercita.
 */

const api = require('../support/api');
const db = require('../support/db');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

describe('POST /v1/auth/register', () => {
  it('201 — crea la cuenta y devuelve la API KEY de un solo uso', async () => {
    const res = await api.register({
      email: api.uniqueEmail(),
      password: api.PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res).toSatisfyApiSpec();
  });

  it('400 — correo mal formado y contraseña por debajo del mínimo', async () => {
    const res = await api.register({
      email: 'esto-no-es-un-correo',
      password: 'corta',
    });

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
  });

  it('409 — el correo ya está registrado', async () => {
    const { email } = await api.createAccount();

    const res = await api.register({ email, password: api.PASSWORD });

    expect(res.status).toBe(409);
    expect(res).toSatisfyApiSpec();
  });

  it('201 — el rol es siempre CUSTOMER aunque se pida ADMIN en el cuerpo', async () => {
    // Garantía declarada en prosa en la especificación, no expresable en el
    // esquema: «ningún usuario externo puede crear una cuenta con rol ADMIN».
    const email = api.uniqueEmail('escalation');
    await api.register({ email, password: api.PASSWORD, role: 'ADMIN' });

    const session = await api.login({ email, password: api.PASSWORD });
    const res = await api
      .request(api.app)
      .get('/v1/auth/me')
      .set(api.bearer(session.body?.token ?? api.MISSING_TOKEN));

    expect(res.body.role).toBe('CUSTOMER');
    expect(res).toSatisfyApiSpec();
  });
});
