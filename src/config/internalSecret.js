'use strict';

/**
 * Validación del secreto interno de la plataforma.
 *
 * `POST /v1/auth/validate-key` no se expone a través de la pasarela: `kong.yml`
 * declara para esa ruta un `request-termination` con 404, porque el contrato
 * dice que ese extremo no debe ser alcanzable desde fuera. Su protección
 * principal es, por tanto, la topología del despliegue; este secreto compartido
 * es la segunda, la que cubre el caso de un llamante que ya está dentro de la
 * red del despliegue pero no es la pasarela.
 *
 * Con un valor por defecto en el código, esa segunda protección no existía: si
 * la variable faltaba —y en el compose de producción faltaba— el servicio
 * arrancaba en silencio aceptando un secreto escrito en el repositorio.
 *
 * EL CRITERIO, que es la parte que hay que poder justificar: se rechaza lo que
 * CONSTA público, no lo que parece débil. La lista de abajo es verificable
 * leyendo este repositorio, y por eso puede defenderse. Una comprobación de
 * longitud mínima o de entropía sería una heurística: no distingue un secreto
 * de una cadena larga cualquiera, no detecta el literal publicado si además es
 * largo, y rechaza secretos legítimos por ser cortos. Se prescinde de ella a
 * propósito.
 *
 * Mismo patrón que `./jwtExpiry.js`: la guarda no comprueba la presencia del
 * valor, comprueba el valor, y el servicio no arranca si no lo pasa. Un secreto
 * público presente es tan inservible como uno ausente.
 */

/**
 * Valores que este repositorio publica y que, por tanto, no son secretos.
 *
 * El primero es el que tenía `src/config/index.js` como valor por defecto y
 * sigue apareciendo en los `.env.example` del ecosistema. El segundo es el
 * marcador que `.env.example` ofrece para que se sustituya: aceptarlo sería
 * dejar pasar exactamente el descuido que la guarda existe para detectar.
 *
 * Al añadir un literal aquí hay que añadirlo también a la prueba, que fija esta
 * lista a propósito para que no crezca sin que nadie lo lea.
 */
const PUBLISHED_LITERALS = [
  'dev_internal_secret_key_789',
  'change_me_with_a_64_byte_random_hex_string',
];

/**
 * Comprueba que el secreto interno está configurado con un valor que no consta
 * en el repositorio.
 *
 * @param {string} value Valor de `INTERNAL_API_SECRET`.
 * @returns {string} El mismo valor, sin normalizar: lo que compara la pasarela
 *   es la cadena tal cual llega, y recortarla aquí cambiaría en silencio la
 *   credencial que el operador cree haber configurado.
 * @throws {Error} Si falta, está vacío o es uno de los literales publicados.
 */
const assertInternalSecretConfigured = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';

  if (trimmed === '') {
    throw new Error(
      'INTERNAL_API_SECRET está ausente o vacío. Es la credencial que protege ' +
        'POST /v1/auth/validate-key, que no se expone a través de la pasarela. ' +
        "Genere uno con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" " +
        'y déjelo igual en api-gateway, que es quien lo presenta.',
    );
  }

  if (PUBLISHED_LITERALS.includes(trimmed)) {
    throw new Error(
      `INTERNAL_API_SECRET tiene un valor que consta publicado en el repositorio: ` +
        `${JSON.stringify(trimmed)}. No es un secreto: cualquiera que lea el código lo conoce. ` +
        'Genere uno propio y déjelo igual en api-gateway.',
    );
  }

  return value;
};

module.exports = { assertInternalSecretConfigured, PUBLISHED_LITERALS };
