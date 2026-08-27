const dotenv = require('dotenv');

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

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/auth-db',
  logLevel: resolveLogLevel(),
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  apiTitle: process.env.API_TITLE || 'Auth Microservice API',
  apiDescription:
    process.env.API_DESCRIPTION ||
    'Autenticación, gestión de usuarios y emisión de API Keys — TFM SaaS Reconocimiento Facial',
  // JWT
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  // Email & Resend
  resendApiKey: process.env.RESEND_API_KEY,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  // Secreto compartido entre componentes internos de la plataforma. Protege
  // `POST /v1/auth/validate-key`, que no se expone a través de la pasarela.
  internalApiSecret: process.env.INTERNAL_API_SECRET || 'dev_internal_secret_key_789',
};

module.exports = config;
