const dotenv = require('dotenv');
const { assertJwtExpiryInRange } = require('./jwtExpiry');
const { assertInternalSecretConfigured } = require('./internalSecret');
const { assertConfigured } = require('./requiredEnv');

dotenv.config();

/**
 * En pruebas el registro se silencia: los errores de los casos 4xx son parte de
 * lo que se está comprobando y llenarían la salida de trazas de excepciones que
 * no indican ningún fallo. `LOG_LEVEL_TEST` permite recuperarlo al depurar.
 *
 * No se delega en `LOG_LEVEL` porque `.env` lo fija y dotenv lo vuelca sobre
 * `process.env` antes de llegar hasta aquí.
 */
const resolveLogLevel = () =>
  process.env.NODE_ENV === 'test'
    ? process.env.LOG_LEVEL_TEST || 'silent'
    : process.env.LOG_LEVEL || 'debug';

const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h';

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // Sin valor por omisión: un defecto aquí arrancaba el servicio contra otra
  // base de datos sin decir nada. Véase `./requiredEnv.js`.
  mongodbUri: assertConfigured('MONGODB_URI', process.env.MONGODB_URI),
  logLevel: resolveLogLevel(),
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  apiTitle: process.env.API_TITLE || 'Auth Microservice API',
  apiDescription:
    process.env.API_DESCRIPTION ||
    'Autenticación, gestión de usuarios y emisión de API Keys — TFM SaaS Reconocimiento Facial',
  // JWT
  jwtSecret: process.env.JWT_SECRET,
  // La vigencia se valida al cargar la configuración: un valor fuera del rango
  // admitido impide arrancar. Véase `./jwtExpiry.js`.
  jwtExpiresIn,
  jwtExpiresInSeconds: assertJwtExpiryInRange(jwtExpiresIn),
  // Email & Resend
  resendApiKey: process.env.RESEND_API_KEY,
  // Sin valor por omisión: va dentro del enlace del correo de recuperación de
  // contraseña, de modo que un defecto rompe la recuperación en silencio.
  frontendUrl: assertConfigured('FRONTEND_URL', process.env.FRONTEND_URL),
  // Secreto compartido entre componentes internos de la plataforma. Protege
  // `POST /v1/auth/validate-key`, que no se expone a través de la pasarela.
  // Se valida al cargar la configuración: ausente, vacío o publicado en el
  // repositorio impide arrancar. Véase `./internalSecret.js`.
  internalApiSecret: assertInternalSecretConfigured(process.env.INTERNAL_API_SECRET),
};

module.exports = config;
