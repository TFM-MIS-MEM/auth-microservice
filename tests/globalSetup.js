'use strict';

/**
 * Arranca UN único MongoDB en memoria para toda la ejecución de la suite.
 * Cada worker de Jest se conecta después a su propia base de datos lógica
 * (véase `tests/support/db.js`), de forma que los ficheros que corren en
 * paralelo no se pisan los datos entre sí.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  const mongod = await MongoMemoryServer.create();

  // Consumido por los workers de Jest y por `src/config`.
  process.env.MONGODB_URI = mongod.getUri();

  // Referencia para el teardown, que corre en este mismo proceso.
  globalThis.__MONGOD__ = mongod;
};
