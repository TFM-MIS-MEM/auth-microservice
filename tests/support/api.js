'use strict';

/**
 * Helpers de invocación HTTP para los tests de contrato.
 *
 * Regla de oro de este fichero: sólo lee campos **declarados en la
 * especificación** (`accountId`, `apiKey`, `token`). Nunca los busca en la
 * envoltura que devuelve hoy el código, porque adaptarse a la implementación
 * actual es justo lo que dejaba la suite anterior sin capacidad de detectar
 * desviaciones.
 *
 * Cuando el registro o el login no devuelven lo que el contrato promete, los
 * helpers caen a un valor de relleno en lugar de romper. Así la petición bajo
 * prueba se llega a emitir siempre y el test falla por el contrato —el motivo
 * que interesa— y no por un `TypeError` en la preparación.
 */

const request = require('supertest');
const expressApp = require('../../src/app');

/**
 * UN ÚNICO servidor escuchando por fichero de prueba, en lugar de uno efímero
 * por petición.
 *
 * `supertest` sólo llama a `listen(0)` cuando lo que recibe no está ya
 * escuchando; si se le pasa un servidor con dirección asignada, reutiliza su
 * puerto. Pasándole la aplicación de Express directamente creaba y cerraba un
 * servidor POR CADA petición: varios cientos por fichero, y más de trescientos
 * sólo entre las tres ráfagas de `burst()`.
 *
 * Esa rotación de puertos efímeros era la causa del no determinismo del issue
 * #90. Se capturaron respuestas con este aspecto:
 *
 *   POST http://127.0.0.1:54914/v1/auth/register  status=404
 *   hdrs={"content-length":"0","content-type":"text/html"}
 *
 * Sin `x-content-type-options` (helmet) ni `x-powered-by` (Express), con el
 * cuerpo vacío y tipo `text/html`: NO las emitió este servicio. Se confirmó
 * además instrumentando `notFound`, que no llegó a ejecutarse. La petición
 * aterrizaba en un puerto recién reciclado que ocupaba otro proceso de la
 * máquina, y el test leía su 404 como si fuera del servicio.
 *
 * Con el puerto tomado para todo el fichero, la ventana de reciclado
 * desaparece: un choque se manifestaría al enlazar, con EADDRINUSE, y no como
 * una respuesta ajena colada a mitad de la batería.
 */
const app = expressApp.listen(0);

// Se cierra al terminar el fichero. `afterAll` está disponible porque este
// módulo lo requiere un fichero de prueba, no el arranque de Jest.
if (typeof afterAll === 'function') {
  afterAll(() => new Promise((resolve) => app.close(resolve)));
}

const PASSWORD = 'SuperSecret123!';

/** Relleno usado cuando el contrato no entregó la credencial prometida. */
const MISSING_TOKEN = 'contract-test-missing-token';
const MISSING_API_KEY = 'contract-test-missing-api-key';
const MISSING_ACCOUNT_ID = '000000000000000000000000';

let sequence = 0;
const uniqueEmail = (prefix = 'account') => {
  sequence += 1;
  return `${prefix}-${process.pid}-${sequence}@example.com`;
};

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

/** POST /v1/auth/register */
const register = (body) => request(app).post('/v1/auth/register').send(body);

/** POST /v1/auth/login */
const login = (body) => request(app).post('/v1/auth/login').send(body);

/**
 * Registra una cuenta y devuelve las credenciales que el contrato promete.
 * No afirma nada: la comprobación del contrato pertenece a los tests.
 */
const createAccount = async ({ email = uniqueEmail(), password = PASSWORD } = {}) => {
  const res = await register({ email, password });

  return {
    res,
    email,
    password,
    accountId: res.body?.accountId ?? MISSING_ACCOUNT_ID,
    apiKey: res.body?.apiKey ?? MISSING_API_KEY,
  };
};

/** Registra una cuenta y abre sesión con ella. */
const createAuthenticatedAccount = async (options) => {
  const account = await createAccount(options);
  const res = await login({ email: account.email, password: account.password });

  return { ...account, token: res.body?.token ?? MISSING_TOKEN };
};

/**
 * Repite una petición hasta obtener un 429 o agotar los intentos.
 * Devuelve la última respuesta recibida.
 *
 * ARITMÉTICA, porque el coste no es evidente: el `credentialRateLimiter`
 * permite 100 peticiones por ventana, de modo que hacen falta **101 viajes de
 * ida y vuelta secuenciales** para que el limitador responda. Son tres las
 * pruebas que dependen de esto —`login`, `forgot-password` y
 * `reset-password`—, o sea unas 303 peticiones de las 399 que hace la suite
 * completa.
 *
 * ESO SÓLO ES VIABLE CON EL SERVIDOR PERSISTENTE de arriba. Cuando `supertest`
 * levantaba y cerraba un servidor por petición, estas tres pruebas tardaban
 * ~290 ms en el caso bueno y superaban el plazo por defecto de Jest —5000 ms—
 * bajo carga, que era la mitad visible del issue #90. Con el puerto tomado para
 * todo el fichero bajan a ~62 ms.
 *
 * De ahí que NO se les haya subido el `testTimeout`: el plazo por defecto deja
 * hoy dos órdenes de magnitud de margen, y una constante ampliada cuya razón de
 * ser ya no existe es justo lo que alguien copia dentro de un año sin saber por
 * qué está. Si estas tres vuelven a acercarse al plazo, el sospechoso no es el
 * plazo: es que algo haya devuelto la creación de servidores por petición.
 */
const burst = async (send, attempts = 120) => {
  let res;
  for (let i = 0; i < attempts; i += 1) {
    // Secuencial a propósito: el limitador cuenta peticiones, no concurrencia.
    // eslint-disable-next-line no-await-in-loop
    res = await send();
    if (res.status === 429) return res;
  }
  return res;
};

module.exports = {
  app,
  request,
  PASSWORD,
  MISSING_TOKEN,
  MISSING_API_KEY,
  MISSING_ACCOUNT_ID,
  uniqueEmail,
  bearer,
  register,
  login,
  createAccount,
  createAuthenticatedAccount,
  burst,
};
