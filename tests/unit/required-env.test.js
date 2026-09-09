'use strict';

/**
 * Guarda de las variables de configuración que no admiten valor por omisión.
 *
 * A diferencia de `internalSecret`, aquí no hay ningún valor «malo»: lo que no
 * se admite es la ausencia. El defecto que tenían estas dos variables no era
 * inseguro, era SILENCIOSO, que en un despliegue viene a ser peor:
 *
 *   - `MONGODB_URI` ausente conectaba a `mongodb://localhost:27017/auth-db`. El
 *     servicio arranca «bien» y responde, contra una base de datos que no es la
 *     suya y probablemente vacía.
 *   - `FRONTEND_URL` ausente ponía `http://localhost:3000` dentro del enlace del
 *     correo de recuperación de contraseña. En producción eso es una
 *     recuperación rota sin un solo error en el registro.
 */

const { assertConfigured } = require('../../src/config/requiredEnv');

describe('assertConfigured', () => {
  it('devuelve el valor cuando está definido', () => {
    expect(assertConfigured('MONGODB_URI', 'mongodb://host/db')).toBe('mongodb://host/db');
  });

  it.each([[undefined], [null], [''], ['   ']])('rechaza %p', (value) => {
    expect(() => assertConfigured('MONGODB_URI', value)).toThrow(/MONGODB_URI/);
  });

  it('el mensaje nombra la variable que falta', () => {
    expect(() => assertConfigured('FRONTEND_URL', undefined)).toThrow(/FRONTEND_URL/);
  });
});

describe('carga de src/config', () => {
  const originalMongo = process.env.MONGODB_URI;
  const originalFrontend = process.env.FRONTEND_URL;

  afterEach(() => {
    process.env.MONGODB_URI = originalMongo;
    process.env.FRONTEND_URL = originalFrontend;
    jest.dontMock('dotenv');
    jest.resetModules();
  });

  it.each([['MONGODB_URI'], ['FRONTEND_URL']])('el servicio no arranca sin %s', (name) => {
    jest.resetModules();
    jest.doMock('dotenv', () => ({ config: () => ({ parsed: {} }) }));
    delete process.env[name];

    expect(() => require('../../src/config')).toThrow(new RegExp(name));
  });
});
