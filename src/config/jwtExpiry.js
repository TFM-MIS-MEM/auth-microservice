'use strict';

/**
 * Validación de la vigencia del JWT.
 *
 * La memoria argumenta la ventana de revocación sobre una caducidad de 60
 * minutos, y `openapi/auth.yaml` la declara. Pero el valor procede de la
 * variable `JWT_EXPIRES_IN`, de modo que sin esta guarda un despliegue podría
 * contradecir el documento sin que nada avisara: el argumento de la memoria
 * dejaría de sostenerse en silencio.
 *
 * Se elige un rango y no un valor exacto porque hay razones legítimas para
 * ajustarlo —una demostración con sesiones cortas, un entorno de desarrollo con
 * sesiones largas—; lo que no puede es salirse de lo defendible.
 */

// Por debajo de 5 minutos el panel obliga a reautenticarse constantemente y
// resulta inusable. Por encima de 2 horas la ventana de revocación deja de ser
// el inconveniente acotado que describe la memoria.
const MIN_SECONDS = 5 * 60;
const MAX_SECONDS = 2 * 60 * 60;

const UNIT_SECONDS = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

/**
 * Convierte a segundos un valor de vigencia en el formato que acepta
 * `jsonwebtoken`: un número de segundos, o una cadena con sufijo de unidad
 * (`30s`, `60m`, `1h`, `7d`).
 *
 * @param {string|number} value
 * @returns {number|null} Los segundos, o `null` si el formato no es válido.
 */
const toSeconds = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') return null;

  const match = /^(\d+(?:\.\d+)?)\s*(s|m|h|d)?$/i.exec(value.trim());
  if (!match) return null;

  // Sin sufijo, `jsonwebtoken` interpreta el número como segundos.
  const unit = match[2] ? match[2].toLowerCase() : 's';

  // Un valor de cero o negativo se devuelve tal cual, para que lo rechace la
  // comprobación de rango con un mensaje que diga cuál es el rango, en lugar
  // de confundirlo con un error de formato.
  return Number(match[1]) * UNIT_SECONDS[unit];
};

/**
 * Comprueba que la vigencia configurada cae dentro del rango admisible.
 *
 * @param {string|number} value Valor de `JWT_EXPIRES_IN`.
 * @returns {number} La vigencia en segundos.
 * @throws {Error} Si el formato no es válido o queda fuera del rango. El
 *   servicio no debe arrancar: es preferible un fallo ruidoso al arranque que
 *   una flota emitiendo sesiones cuya caducidad contradice lo documentado.
 */
const assertJwtExpiryInRange = (value) => {
  const seconds = toSeconds(value);

  if (seconds === null) {
    throw new Error(
      `JWT_EXPIRES_IN tiene un formato no reconocido: ${JSON.stringify(value)}. ` +
        'Use un número de segundos o una cadena con sufijo (por ejemplo "60m" o "1h").',
    );
  }

  if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
    throw new Error(
      `JWT_EXPIRES_IN está fuera del rango admitido: ${JSON.stringify(value)} ` +
        `equivale a ${seconds} s, y debe estar entre ${MIN_SECONDS} s (5 minutos) y ` +
        `${MAX_SECONDS} s (2 horas). Por debajo el panel resulta inusable; por encima ` +
        'deja de sostenerse el argumento de la ventana de revocación.',
    );
  }

  return seconds;
};

module.exports = { assertJwtExpiryInRange, toSeconds, MIN_SECONDS, MAX_SECONDS };
