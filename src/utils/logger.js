const config = require('../config');

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = LOG_LEVELS[config.logLevel] ?? LOG_LEVELS.debug;

const logger = {
  error: (...args) => {
    if (currentLevel >= LOG_LEVELS.error) {
      // eslint-disable-next-line no-console
      console.error('[ERROR]', new Date().toISOString(), ...args);
    }
  },
  warn: (...args) => {
    if (currentLevel >= LOG_LEVELS.warn) {
      // eslint-disable-next-line no-console
      console.warn('[WARN]', new Date().toISOString(), ...args);
    }
  },
  info: (...args) => {
    if (currentLevel >= LOG_LEVELS.info) {
      // eslint-disable-next-line no-console
      console.info('[INFO]', new Date().toISOString(), ...args);
    }
  },
  debug: (...args) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      // eslint-disable-next-line no-console
      console.debug('[DEBUG]', new Date().toISOString(), ...args);
    }
  },
};

module.exports = logger;
