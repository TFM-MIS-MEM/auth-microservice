'use strict';

/**
 * Contrato de `validateKey` — POST /v1/auth/validate-key.
 *
 * Endpoint bloqueante del proyecto: hasta que no devuelva `accountId`, la
 * pasarela no puede propagar `X-Account-Id` y `fr-commercial` no puede
 * determinar la propiedad de las galerías. Es también el único que no tenía
 * ninguna prueba.
 */

const api = require('../support/api');
const db = require('../support/db');

const validateKey = (apiKey) => {
  const req = api.request(api.app).post('/v1/auth/validate-key');

  // La clave viaja en cabecera, no en el cuerpo: reduce su exposición en
  // registros y trazas.
  if (apiKey !== null) req.set('X-API-Key', apiKey);

  return req.send();
};

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

describe('POST /v1/auth/validate-key', () => {
  it('200 — clave válida: devuelve el veredicto, el accountId y el estado', async () => {
    const { apiKey } = await api.createAccount();

    const res = await validateKey(apiKey);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
  });

  it('200 — el accountId devuelto es el de la cuenta propietaria de la clave', async () => {
    const { apiKey, accountId } = await api.createAccount();

    const res = await validateKey(apiKey);

    // Único campo cuyo valor concreto se comprueba: es la razón de ser del
    // endpoint y el esquema por sí solo no puede verificar la correspondencia.
    expect(res.body.accountId).toBe(accountId);
    expect(res).toSatisfyApiSpec();
  });

  it('200 — clave de una cuenta suspendida: el estado viaja en la respuesta', async () => {
    const { apiKey, email } = await api.createAccount();
    await db.patchAccountDocument(email, { status: 'suspended' });

    const res = await validateKey(apiKey);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — la clave anterior deja de ser válida tras rotarla', async () => {
    const account = await api.createAuthenticatedAccount();
    await api
      .request(api.app)
      .post('/v1/auth/rotate-key')
      .set(api.bearer(account.token))
      .send({ password: account.password });

    const res = await validateKey(account.apiKey);

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — sin cabecera X-API-Key', async () => {
    const res = await validateKey(null);

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — la clave no corresponde a ninguna cuenta', async () => {
    const res = await validateKey('clave-que-no-existe');

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });
});
