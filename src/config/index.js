const dotenv = require('dotenv');

dotenv.config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/auth-db',
  logLevel: process.env.LOG_LEVEL || 'debug',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  apiTitle: process.env.API_TITLE || 'Auth Microservice API',
  apiDescription:
    process.env.API_DESCRIPTION ||
    'Autenticación, gestión de usuarios y emisión de API Keys — TFM SaaS Reconocimiento Facial',
};

module.exports = config;
