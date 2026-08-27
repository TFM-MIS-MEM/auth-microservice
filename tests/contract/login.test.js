'use strict';

/** Contrato de `login` — POST /v1/auth/login. */

const jwt = require('jsonwebtoken');
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

  it('403 — la cuenta está suspendida', async () => {
    // La ventana de revocación documentada afecta a los JWT ya emitidos, que
    // siguen verificando por firma hasta caducar. No habilita a una cuenta
    // suspendida a obtener uno nuevo: si lo hiciera, bastaría con volver a
    // iniciar sesión al caducar el token anterior y la suspensión no tendría
    // efecto alguno sobre el canal web.
    const { email, password } = await api.createAccount();
    await db.patchAccountDocument(email, { status: 'suspended' });

    const res = await api.login({ email, password });

    expect(res.status).toBe(403);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — contraseña incorrecta sobre una cuenta suspendida', async () => {
    // Fija el ORDEN de comprobación, no su existencia: la credencial se
    // verifica antes que el estado. Si el estado fuese primero, este caso
    // devolvería 403 y cualquiera con un correo y una contraseña inventada
    // sabría que la cuenta existe y está suspendida.
    const { email } = await api.createAccount();
    await db.patchAccountDocument(email, { status: 'suspended' });

    const res = await api.login({ email, password: 'ContraseñaEquivocada1!' });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('200 — el JWT lleva los claims que consume la pasarela', async () => {
    // El contenido del token es un contrato entre `auth` y Kong que OpenAPI no
    // puede recoger: para la especificación un bearer token es opaco. Se fija
    // aquí porque el plugin de la pasarela lo consume, y sin esta prueba un
    // cambio de claims sólo se descubriría al integrar. Véase la sección
    // «Estructura del JWT» de CLAUDE.md.
    const { email, password, accountId } = await api.createAccount();

    const res = await api.login({ email, password });
    const claims = jwt.decode(res.body.token);

    expect(claims.sub).toBe(accountId); // → X-Account-Id
    expect(claims.role).toBe('CUSTOMER'); // → X-Role
    expect(claims.exp - claims.iat).toBe(3600); // 60 minutos
    expect(claims.iss).toBe('auth-microservice');
    expect(res.body.expiresIn).toBe(claims.exp - claims.iat);
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
