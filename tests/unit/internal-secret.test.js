'use strict';

/**
 * Guarda de configuración del secreto interno.
 *
 * `POST /v1/auth/validate-key` no se expone a través de la pasarela —`kong.yml`
 * la corta con un 404— y el aislamiento de red es su protección principal. El
 * secreto compartido es la segunda. Con un valor por defecto en el código, esa
 * segunda protección no existía: si la variable faltaba, el servicio arrancaba
 * aceptando un secreto que está escrito en el repositorio.
 *
 * Mismo criterio que `jwtExpiry`: la guarda no comprueba la presencia del
 * valor, comprueba el valor. Un secreto público presente es tan inservible como
 * uno ausente.
 */

const {
  assertInternalSecretConfigured,
  PUBLISHED_LITERALS,
} = require('../../src/config/internalSecret');

describe('assertInternalSecretConfigured', () => {
  it('acepta un secreto que no consta en el repositorio', () => {
    expect(assertInternalSecretConfigured('3f9a1c...no-publicado')).toBe('3f9a1c...no-publicado');
  });

  it.each([[undefined], [null], [''], ['   '], [42], [{}]])(
    'rechaza %p por ausente o vacío',
    (value) => {
      expect(() => assertInternalSecretConfigured(value)).toThrow(/ausente o vacío/);
    },
  );

  it.each([
    ['dev_internal_secret_key_789', 'el valor por defecto que tenía el código'],
    ['change_me_with_a_64_byte_random_hex_string', 'el marcador de .env.example'],
  ])('rechaza %p — %s', (value) => {
    expect(() => assertInternalSecretConfigured(value)).toThrow(/consta publicado/);
  });

  it('rechaza un literal publicado aunque venga con espacios alrededor', () => {
    expect(() => assertInternalSecretConfigured('  dev_internal_secret_key_789  ')).toThrow(
      /consta publicado/,
    );
  });

  /**
   * El criterio se prueba por lo que NO hace: nada de longitud mínima ni de
   * entropía. Que un secreto sea corto no lo hace público, y que sea largo no
   * lo hace secreto. Lo único verificable leyendo el repositorio es si el valor
   * está escrito en él.
   */
  it('no rechaza un secreto corto: la guarda mira publicación, no fortaleza', () => {
    expect(() => assertInternalSecretConfigured('x')).not.toThrow();
  });

  it('la lista de literales publicados es la que aparece en el repositorio', () => {
    expect(PUBLISHED_LITERALS).toEqual([
      'dev_internal_secret_key_789',
      'change_me_with_a_64_byte_random_hex_string',
    ]);
  });
});

describe('carga de src/config', () => {
  const original = process.env.INTERNAL_API_SECRET;

  afterEach(() => {
    process.env.INTERNAL_API_SECRET = original;
    jest.dontMock('dotenv');
    jest.resetModules();
  });

  it('el servicio no arranca con el secreto por defecto que tenía el código', () => {
    process.env.INTERNAL_API_SECRET = 'dev_internal_secret_key_789';
    jest.resetModules();

    expect(() => require('../../src/config')).toThrow(/consta publicado/);
  });

  /**
   * `dotenv` se sustituye porque, con `.env` presente en el directorio de
   * trabajo, borrar la variable de `process.env` no basta: `dotenv` la
   * repondría al cargar la configuración y la guarda no llegaría a evaluarse.
   * Es justo el motivo por el que el agujero pasaba desapercibido en local.
   */
  it('el servicio no arranca si la variable falta del todo', () => {
    jest.resetModules();
    jest.doMock('dotenv', () => ({ config: () => ({ parsed: {} }) }));
    delete process.env.INTERNAL_API_SECRET;

    expect(() => require('../../src/config')).toThrow(/ausente o vacío/);
  });
});
