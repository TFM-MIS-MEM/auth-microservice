'use strict';

/**
 * Variables de configuración que no admiten valor por omisión.
 *
 * No todas las que lo tienen están mal. `API_TITLE`, `LOG_LEVEL` o `NODE_ENV`
 * tienen un defecto razonable y su ausencia no cambia lo que el servicio
 * promete. Las que pasan por aquí son las que sí: su defecto no era inseguro,
 * era SILENCIOSO, y un despliegue mal configurado arrancaba sin un solo error.
 *
 *   - `MONGODB_URI` ausente conectaba a `mongodb://localhost:27017/auth-db`.
 *     El servicio arranca, responde y pasa su propio health check, contra una
 *     base de datos que no es la suya.
 *   - `FRONTEND_URL` ausente ponía `http://localhost:3000` dentro del enlace del
 *     correo de recuperación de contraseña (`src/services/email.service.js`).
 *     En producción eso es una recuperación de cuenta rota, y el registro no
 *     dice nada porque desde el punto de vista del servicio no ha fallado nada.
 *
 * Ambas se comprueban por presencia y no por forma: validar que una URI de
 * Mongo o una URL de frontal son «correctas» exigiría decidir qué cuenta como
 * correcta, y eso son reglas de despliegue que este servicio no conoce. Lo que
 * sí puede afirmar es que nadie las ha configurado.
 */

/**
 * @param {string} name Nombre de la variable, para el mensaje de error.
 * @param {string} value Su valor.
 * @returns {string} El valor, si está.
 * @throws {Error} Si falta o está vacío. El servicio no debe arrancar: es
 *   preferible un fallo ruidoso al arranque que un servicio en pie apuntando a
 *   donde no es.
 */
const assertConfigured = (name, value) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `${name} está ausente o vacío y no tiene valor por omisión. ` +
        'Decláralo en el entorno del servicio; véase .env.example.',
    );
  }

  return value;
};

module.exports = { assertConfigured };
