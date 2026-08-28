'use strict';

/**
 * Guarda de configuración de la vigencia del JWT.
 *
 * No es un test de contrato: `openapi/auth.yaml` no puede expresar esta regla,
 * igual que no puede expresar los claims del token. Se prueba aquí porque la
 * memoria argumenta la ventana de revocación sobre una caducidad de 60 minutos
 * y `JWT_EXPIRES_IN` es una variable de entorno: sin la guarda, un despliegue
 * podría contradecir el documento sin que nada avisara.
 */

const { assertJwtExpiryInRange, MIN_SECONDS, MAX_SECONDS } = require('../../src/config/jwtExpiry');

describe('assertJwtExpiryInRange', () => {
  it.each([
    ['60m', 3600],
    ['1h', 3600],
    ['5m', MIN_SECONDS],
    ['2h', MAX_SECONDS],
    ['300', 300],
    [3600, 3600],
  ])('acepta %p y lo resuelve a %i s', (value, expected) => {
    expect(assertJwtExpiryInRange(value)).toBe(expected);
  });

  it.each([
    ['4m', 'por debajo del mínimo: el panel obligaría a reautenticarse sin parar'],
    ['3h', 'por encima del máximo: la ventana de revocación dejaría de ser acotada'],
    ['0', 'sin vigencia'],
    ['86400', 'un día entero, expresado en segundos'],
  ])('rechaza %p — %s', (value) => {
    expect(() => assertJwtExpiryInRange(value)).toThrow(/fuera del rango admitido/);
  });

  it.each([['banana'], ['-5m'], ['1 hora'], [''], [null], [undefined]])(
    'rechaza %p por formato no reconocido',
    (value) => {
      expect(() => assertJwtExpiryInRange(value)).toThrow(/formato no reconocido/);
    },
  );

  it('los extremos del rango son los documentados en CLAUDE.md', () => {
    expect(MIN_SECONDS).toBe(5 * 60);
    expect(MAX_SECONDS).toBe(2 * 60 * 60);
  });
});

describe('carga de src/config', () => {
  const originalValue = process.env.JWT_EXPIRES_IN;

  afterEach(() => {
    process.env.JWT_EXPIRES_IN = originalValue;
    jest.resetModules();
  });

  it('el servicio no arranca con una vigencia fuera de rango', () => {
    process.env.JWT_EXPIRES_IN = '3h';
    jest.resetModules();

    // El fallo se produce al cargar la configuración, antes de que el servicio
    // llegue a escuchar: es preferible un arranque ruidoso a una flota
    // emitiendo sesiones cuya caducidad contradice lo documentado.
    expect(() => require('../../src/config')).toThrow(/fuera del rango admitido/);
  });

  it('expone la vigencia ya resuelta en segundos', () => {
    process.env.JWT_EXPIRES_IN = '60m';
    jest.resetModules();

    expect(require('../../src/config').jwtExpiresInSeconds).toBe(3600);
  });
});
