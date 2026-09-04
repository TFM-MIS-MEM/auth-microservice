'use strict';

/**
 * Forma del cuerpo de error, extremo a extremo — patrón ERROR REPORT.
 *
 * Los demás ficheros de esta carpeta comprueban QUÉ estado devuelve cada
 * operación. Éste comprueba QUÉ LLEVA DENTRO el cuerpo cuando ese estado es un
 * error, con un caso por cada causa distinta que puede producirlo. El solape en
 * los códigos con el resto de la batería es deliberado: aquí el estado es sólo
 * la manera de llegar al cuerpo, que es lo que se está fijando.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTE FICHERO AFIRMA COSAS QUE `toSatisfyApiSpec()` NO AFIRMA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Cada caso llama a `toSatisfyApiSpec()` **y ADEMÁS** comprueba a mano que el
 * cuerpo no lleva más campos que los del contrato. Lo segundo parece redundante
 * y no lo es, y conviene que se entienda sin contexto porque es un hallazgo
 * sobre el método, no sobre este servicio:
 *
 *   `ErrorReport` no declara `additionalProperties: false`, y su campo
 *   `details` declara `additionalProperties: true`. En JSON Schema eso
 *   significa que un cuerpo con campos de MÁS es conforme. La respuesta que
 *   motivó el issue #79 —`{code, message, details: {stack: "...", …}}`, con
 *   rutas absolutas del contenedor y las versiones exactas de las
 *   dependencias— SATISFACÍA la especificación. `toSatisfyApiSpec()` no podía
 *   rechazarla, y en efecto no la rechazó: la fuga convivió con 69 pruebas en
 *   verde.
 *
 * Es el mismo límite que la memoria ya describe a propósito del `429` de la
 * pasarela, y el simétrico: allí una respuesta que INCUMPLE el esquema pasa sin
 * que nadie la mire, porque la emite un componente que la batería no atraviesa;
 * aquí una respuesta que CUMPLE el esquema filtra información, porque el
 * esquema es más permisivo de lo que la intención del contrato daba a entender.
 * En los dos casos la conclusión es la misma: **la conformidad automática
 * comprueba que no falta nada de lo declarado, no que no sobre nada**. Lo que el
 * esquema no puede prohibir hay que escribirlo como prueba, y este bloque es esa
 * prueba.
 *
 * La vía de fondo —añadir `additionalProperties: false` a `ErrorReport`— es un
 * cambio de contrato que afecta a los tres servicios y queda para la fase 2. NO
 * se toca `openapi/auth.yaml` aquí.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ NO ESTÁ AQUÍ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * El error NO operacional (500) se cubre en `tests/unit/error-handler.test.js` y
 * no extremo a extremo: provocarlo por HTTP exigiría romper a propósito una
 * dependencia del servicio —tumbar la conexión a Mongo a mitad de petición—, y
 * el contrato además no declara `500` en ninguna operación (CLAUDE.md §6: las
 * respuestas accidentales no se declaran), de modo que `toSatisfyApiSpec()`
 * rechazaría la respuesta por no estar declarada aunque su cuerpo fuese
 * correcto. La unidad lo comprueba mejor y sin montar nada.
 */

const jwt = require('jsonwebtoken');
const api = require('../support/api');
const db = require('../support/db');

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

/**
 * Marcas de la fuga, tomadas de la salida real del servicio en desarrollo:
 *
 *   "stack": "Error: ...\n    at protect (/app/src/middlewares/auth.js:26:19)
 *      \n    at Layer.handle (/app/node_modules/.pnpm/express@4.22.2_...
 *
 * `.pnpm` va aparte de `node_modules` a propósito: es la que convierte la fuga
 * de estructural en explotable, porque la disposición de pnpm codifica la
 * VERSIÓN EXACTA de cada dependencia en la ruta. Quien busque un CVE aplicable
 * no tiene que adivinarla.
 */
const expectNoTrace = (body) => {
  const serialised = JSON.stringify(body);

  expect(serialised).not.toMatch(/stack/i);
  expect(serialised).not.toMatch(/\/app\//);
  expect(serialised).not.toMatch(/node_modules/);
  expect(serialised).not.toMatch(/\.pnpm/);
  expect(serialised).not.toMatch(/\\n\s*at /);
};

/**
 * Lo que `ErrorReport` declara y nada más. `details` se admite porque el
 * contrato lo declara opcional; lo que no se admite es que aparezca ningún
 * campo fuera de los tres.
 */
const expectErrorReport = (res, { code }) => {
  expect(Object.keys(res.body).every((key) => ['code', 'message', 'details'].includes(key))).toBe(
    true,
  );
  expect(res.body.code).toBe(code);
  expect(typeof res.body.message).toBe('string');
  expect(res.body.message.length).toBeGreaterThan(0);
  expectNoTrace(res.body);
};

const get = (path, token) => {
  const req = api.request(api.app).get(path);
  if (token) req.set(api.bearer(token));
  return req.send();
};

const validateKey = (apiKey, internalSecret) => {
  const req = api.request(api.app).post('/v1/auth/validate-key');
  if (internalSecret !== null) req.set('X-Internal-Secret', internalSecret);
  if (apiKey !== null) req.set('X-API-Key', apiKey);
  return req.send();
};

/** Único modo de disponer de un ADMIN: el registro asigna siempre CUSTOMER. */
const createAdmin = async () => {
  const account = await api.createAccount({ email: api.uniqueEmail('admin') });
  await db.patchAccountDocument(account.email, { role: 'ADMIN' });

  const session = await api.login({ email: account.email, password: account.password });

  return { ...account, token: session.body?.token ?? api.MISSING_TOKEN };
};

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

// ═══════════════════════════════════════════════════════════════════════════
// 400 — petición mal formada
// ═══════════════════════════════════════════════════════════════════════════

describe('400 — el cuerpo de error por causa', () => {
  it('A · validación del cuerpo (Joi): register con correo y contraseña inválidos', async () => {
    // La causa con más alcance: la produce cualquiera, sin credencial, y el
    // mensaje de Joi ya es largo, de modo que la traza pasaba desapercibida
    // entre el resto del cuerpo. `validate` construye el AppError sin `code`,
    // así que este caso fija además el defecto del manejador.
    const res = await api.register({ email: 'no-es-un-correo', password: 'corta' });

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
    expectErrorReport(res, { code: 'BAD_REQUEST' });
  });

  it('B · token de recuperación inválido o caducado', async () => {
    const res = await api
      .request(api.app)
      .post('/v1/auth/reset-password')
      .send({ token: 'token-que-no-existe', newPassword: 'OtraContraseña123!' });

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
    expectErrorReport(res, { code: 'INVALID_RESET_TOKEN' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 401 — credencial ausente o inválida
// ═══════════════════════════════════════════════════════════════════════════

describe('401 — el cuerpo de error por causa', () => {
  it('C1 · sin cabecera Authorization', async () => {
    const res = await get('/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
    expectErrorReport(res, { code: 'UNAUTHORIZED' });
  });

  it('C2 · JWT firmado con otra clave', async () => {
    const token = jwt.sign(
      { sub: api.MISSING_ACCOUNT_ID, role: 'CUSTOMER' },
      'otra-clave-distinta',
    );

    const res = await get('/v1/auth/me', token);

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
    expectErrorReport(res, { code: 'UNAUTHORIZED' });
  });

  it('C3 · JWT caducado', async () => {
    const { accountId } = await api.createAccount();
    const token = jwt.sign({ sub: accountId, role: 'CUSTOMER' }, process.env.JWT_SECRET, {
      expiresIn: '-1s',
    });

    const res = await get('/v1/auth/me', token);

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
    expectErrorReport(res, { code: 'UNAUTHORIZED' });
  });

  it('C4 · la cuenta del token ya no existe', async () => {
    // Única de las cuatro variantes de `protect` que llega a consultar Mongo:
    // firma y caducidad se verifican antes, sin tocar la base de datos.
    const account = await api.createAuthenticatedAccount();
    await api
      .request(api.app)
      .delete('/v1/auth/account')
      .set(api.bearer(account.token))
      .send({ password: account.password });

    const res = await get('/v1/auth/me', account.token);

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
    expectErrorReport(res, { code: 'UNAUTHORIZED' });
  });

  it('D · sin el secreto interno en validate-key', async () => {
    const { apiKey } = await api.createAccount();

    const res = await validateKey(apiKey, null);

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
    expectErrorReport(res, { code: 'UNAUTHORIZED' });
  });

  it('E · login con contraseña incorrecta', async () => {
    // El escenario que motiva #79: repetible por cualquiera, sin credencial y
    // sin dejar rastro más allá de un intento fallido. Cada repetición devolvía
    // la estructura de directorios del contenedor y las versiones exactas de
    // las dependencias.
    const { email } = await api.createAccount();

    const res = await api.login({ email, password: 'ContraseñaEquivocada1!' });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
    expectErrorReport(res, { code: 'UNAUTHORIZED' });
  });

  it('F · API KEY que no corresponde a ninguna cuenta', async () => {
    const res = await validateKey('clave-que-no-existe', process.env.INTERNAL_API_SECRET);

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
    expectErrorReport(res, { code: 'INVALID_API_KEY' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 404 — recurso no encontrado
// ═══════════════════════════════════════════════════════════════════════════

describe('404 — el cuerpo de error por causa', () => {
  it('G · ruta inexistente', async () => {
    // Sin `toSatisfyApiSpec()`, y no por descuido: la ruta no existe en la
    // especificación, así que el matcher fallaría por no encontrar la
    // operación, no por el cuerpo. CLAUDE.md §6 lo deja fuera a propósito —el
    // 404 de ruta inexistente es una respuesta de plataforma y no se declara—,
    // lo que NO exime a su cuerpo de cumplir ErrorReport: es el error que más
    // fácil provoca un desconocido, basta con pedir cualquier cosa.
    const res = await get('/v1/auth/ruta-inexistente');

    expect(res.status).toBe(404);
    expectErrorReport(res, { code: 'NOT_FOUND' });
  });

  it('H · cuenta inexistente al cambiar su estado', async () => {
    const admin = await createAdmin();

    const res = await api
      .request(api.app)
      .patch(`/v1/auth/accounts/${api.MISSING_ACCOUNT_ID}/status`)
      .set(api.bearer(admin.token))
      .send({ status: 'suspended' });

    expect(res.status).toBe(404);
    expect(res).toSatisfyApiSpec();
    expectErrorReport(res, { code: 'ACCOUNT_NOT_FOUND' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// El entorno en el que la fuga se producía
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Todo lo anterior corre con `NODE_ENV=test`, que es donde la guarda anterior
 * —`if (!config.isProduction && !config.isTest)`— ya suprimía la traza. Es
 * decir: en verde antes y después de la corrección. Fija la forma del cuerpo,
 * pero NO reproduce el fallo.
 *
 * Este bloque sí. Reconstruye la aplicación con `NODE_ENV=development`, que es
 * como la levanta `docker-compose.dev.yml`, y repite los cuatro casos que un
 * desconocido puede provocar sin ninguna credencial. Es el bloque que sale en
 * rojo contra el manejador anterior, y el que corresponde uno a uno con la
 * verificación por `curl` —directa y a través de la pasarela— que acompaña al PR.
 *
 * La aplicación se carga en un registro de módulos limpio, así que trae SU
 * propia instancia de mongoose: la conexión hay que abrirla dentro del mismo
 * registro, después del `resetModules`, o los modelos quedarían sin conexión.
 */
describe('en NODE_ENV=development — el escenario de #79', () => {
  let devApp;
  let devMongoose;
  const devDbName = `auth_contract_dev_${process.env.JEST_WORKER_ID || '1'}`;

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';
    // Fuera de `test`, `src/config` resuelve el nivel de registro a `debug` y
    // los 4xx esperados de este bloque llenarían la salida de trazas.
    process.env.LOG_LEVEL = 'silent';
    jest.resetModules();

    devMongoose = require('mongoose');
    await devMongoose.connect(process.env.MONGODB_URI, { dbName: devDbName });
    devApp = require('../../src/app');
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    // Higiene: el cambio de entorno no puede desbordarse al resto de la suite.
    // La aplicación ya construida sobrevive —`src/config` se leyó al cargarla,
    // no en cada petición—, de modo que los casos siguientes de este bloque
    // siguen ejecutándose en desarrollo.
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    jest.resetModules();
  });

  afterAll(async () => {
    await devMongoose.connection.dropDatabase();
    await devMongoose.disconnect();
    delete process.env.LOG_LEVEL;
  });

  it('A · 400 por validación del cuerpo', async () => {
    const res = await api
      .request(devApp)
      .post('/v1/auth/register')
      .send({ email: 'no-es-un-correo', password: 'corta' });

    expect(res.status).toBe(400);
    expectErrorReport(res, { code: 'BAD_REQUEST' });
  });

  it('C1 · 401 sin cabecera Authorization', async () => {
    // De las cuatro variantes de `protect`, ésta: es la que no exige credencial
    // alguna para provocarla, que es justo el supuesto del issue.
    const res = await api.request(devApp).get('/v1/auth/me').send();

    expect(res.status).toBe(401);
    expectErrorReport(res, { code: 'UNAUTHORIZED' });
  });

  it('E · 401 por login fallido, repetible sin credencial', async () => {
    const email = api.uniqueEmail('dev');
    await api.request(devApp).post('/v1/auth/register').send({ email, password: api.PASSWORD });

    const res = await api
      .request(devApp)
      .post('/v1/auth/login')
      .send({ email, password: 'ContraseñaEquivocada1!' });

    expect(res.status).toBe(401);
    expectErrorReport(res, { code: 'UNAUTHORIZED' });
  });

  it('G · 404 por ruta inexistente', async () => {
    const res = await api.request(devApp).get('/v1/auth/ruta-inexistente').send();

    expect(res.status).toBe(404);
    expectErrorReport(res, { code: 'NOT_FOUND' });
  });
});
