'use strict';

/**
 * Manejador global de errores, aislado — patrón ERROR REPORT.
 *
 * No es un test de contrato, y la distinción importa. La batería de contrato no
 * puede cubrir esto por DOS motivos independientes, y hacen falta los dos para
 * entender por qué la fuga de #79 convivió con 69 pruebas en verde:
 *
 *  1. `ErrorReport` no declara `additionalProperties: false`, y su `details`
 *     declara `additionalProperties: true`. Un cuerpo con la traza de pila
 *     dentro de `details` CUMPLE la especificación, de modo que
 *     `toSatisfyApiSpec()` nunca lo iba a rechazar. Véase el comentario de
 *     `tests/contract/error-report.test.js`, donde está el razonamiento
 *     completo.
 *
 *  2. La versión anterior emitía la traza bajo
 *     `if (!config.isProduction && !config.isTest)`. Bajo Jest, `NODE_ENV` vale
 *     `test`, así que el fallo NI SIQUIERA SE PRODUCÍA durante la suite: era
 *     invisible a cualquier prueba que no cambiase de entorno a propósito.
 *
 * De ahí la forma de este fichero: recarga el manejador con `jest.resetModules()`
 * bajo cada `NODE_ENV` y comprueba el cuerpo resultante. Es el único sitio donde
 * el escenario del issue —el servicio corriendo en desarrollo, que es como lo
 * levanta `docker-compose.dev.yml`— es reproducible.
 */

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

/**
 * Carga el manejador y su registro en un registro de módulos limpio, con el
 * `NODE_ENV` indicado ya fijado: `src/config` lo lee al cargarse, no en cada
 * petición, así que el orden es obligatorio.
 *
 * Ambos `require` van después del mismo `resetModules`, de modo que comparten
 * registro y el espía sobre `logger` es el que ve el manejador.
 */
const loadHandler = (nodeEnv) => {
  process.env.NODE_ENV = nodeEnv;
  jest.resetModules();

  const logger = require('../../src/utils/logger');
  const errorHandler = require('../../src/middlewares/errorHandler');

  return { errorHandler, logger };
};

/** Doble de `res` que se queda con el estado y el cuerpo en lugar de emitirlos. */
const fakeResponse = () => {
  const res = { statusCode: undefined, body: undefined };

  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };

  return res;
};

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
  // La traza serializada dentro de una cadena JSON: "...\n    at Layer.handle".
  expect(serialised).not.toMatch(/\\n\s*at /);
};

/** Error operacional: un camino previsto del contrato. */
const operationalError = (statusCode, code) => {
  const AppError = require('../../src/utils/AppError');
  return new AppError('Authentication credential is missing', statusCode, code);
};

/**
 * Error NO operacional: un fallo del servicio. Se construye con un mensaje que
 * delata infraestructura, para que la prueba distinga «no lleva traza» de «no
 * lleva nada de dentro».
 */
const unexpectedError = () => new Error('connect ECONNREFUSED 10.0.4.7:27017');

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  jest.resetModules();
  jest.restoreAllMocks();
});

/**
 * Los tres entornos, la misma expectativa. Que `production` esté en la lista no
 * es relleno: fija que la corrección NO consiste en mover la condición, sino en
 * quitarla. Con la guarda anterior, `production` ya pasaba y `development` no.
 */
describe.each([['development'], ['test'], ['production']])(
  'errorHandler con NODE_ENV=%s',
  (nodeEnv) => {
    it('el cuerpo de un error operacional es exactamente { code, message }', () => {
      const { errorHandler, logger } = loadHandler(nodeEnv);
      jest.spyOn(logger, 'error').mockImplementation(() => {});
      const res = fakeResponse();

      errorHandler(operationalError(401, 'UNAUTHORIZED'), {}, res, () => {});

      expect(res.statusCode).toBe(401);
      expect(Object.keys(res.body).sort()).toEqual(['code', 'message']);
      expect(res.body).toEqual({
        code: 'UNAUTHORIZED',
        message: 'Authentication credential is missing',
      });
      expectNoTrace(res.body);
    });

    it('el cuerpo de un error no operacional tampoco lleva traza, y enmascara el mensaje', () => {
      const { errorHandler, logger } = loadHandler(nodeEnv);
      jest.spyOn(logger, 'error').mockImplementation(() => {});
      const res = fakeResponse();

      errorHandler(unexpectedError(), {}, res, () => {});

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
      // El mensaje original llevaba la IP y el puerto de la base de datos.
      expect(res.body.message).not.toMatch(/ECONNREFUSED|27017/);
      expectNoTrace(res.body);
    });

    it('un `details` legítimo sí viaja, y sigue sin llevar traza', () => {
      // `details` es parte del contrato y la corrección no lo retira: lo que se
      // retira es la traza que se colaba dentro de él.
      const { errorHandler, logger } = loadHandler(nodeEnv);
      jest.spyOn(logger, 'error').mockImplementation(() => {});
      const err = operationalError(400, 'BAD_REQUEST');
      err.details = { field: 'email' };
      const res = fakeResponse();

      errorHandler(err, {}, res, () => {});

      expect(Object.keys(res.body).sort()).toEqual(['code', 'details', 'message']);
      expect(res.body.details).toEqual({ field: 'email' });
      expectNoTrace(res.body);
    });
  },
);

describe('errorHandler — la traza va al registro', () => {
  it('un error NO operacional escribe la traza en el registro', () => {
    // La otra mitad de la corrección, y la que ninguna respuesta HTTP puede
    // comprobar: quitar la traza del cuerpo sin dejarla en el registro sería
    // cambiar una fuga por una ceguera. Quien opera el servicio la sigue
    // teniendo; el cliente externo, no.
    const { errorHandler, logger } = loadHandler('production');
    const spy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const err = unexpectedError();

    errorHandler(err, {}, fakeResponse(), () => {});

    expect(spy).toHaveBeenCalledWith(err.stack);
  });

  it('un error operacional NO escribe la traza: es un camino previsto, no un fallo', () => {
    const { errorHandler, logger } = loadHandler('production');
    const spy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    errorHandler(operationalError(401, 'UNAUTHORIZED'), {}, fakeResponse(), () => {});

    // Se registra la línea de resumen, pero ninguna llamada lleva la traza.
    expect(spy).toHaveBeenCalledWith('401 — Authentication credential is missing');
    for (const [argument] of spy.mock.calls) {
      expect(String(argument)).not.toMatch(/\n\s*at /);
    }
  });
});

describe('errorHandler — vocabulario de códigos', () => {
  /**
   * `ErrorReport` declara `code` como cadena libre, de modo que la
   * especificación NO puede fijar este vocabulario y ningún test de contrato lo
   * protege: si el manejador escribiera `UNAUTHORISED` en lugar de
   * `UNAUTHORIZED`, la suite seguiría en verde y el cliente se rompería. Por eso
   * se fija aquí, igual que se fija en `pricing`.
   */
  it.each([
    [400, 'BAD_REQUEST'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [429, 'RATE_LIMIT_EXCEEDED'],
    [500, 'INTERNAL_ERROR'],
  ])('un %i sin código propio se reporta como %s', (statusCode, expected) => {
    const { errorHandler, logger } = loadHandler('production');
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    const err = operationalError(statusCode, undefined);
    const res = fakeResponse();

    errorHandler(err, {}, res, () => {});

    expect(res.body.code).toBe(expected);
  });

  it('el código del propio error gana sobre el defecto del estado', () => {
    const { errorHandler, logger } = loadHandler('production');
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    const res = fakeResponse();

    errorHandler(operationalError(401, 'INVALID_API_KEY'), {}, res, () => {});

    expect(res.body.code).toBe('INVALID_API_KEY');
  });
});
