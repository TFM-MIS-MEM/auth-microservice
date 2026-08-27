'use strict';

/**
 * Conexión a la base de datos de test.
 *
 * Cada worker de Jest usa su propia base de datos lógica dentro del mismo
 * servidor en memoria, para que los ficheros que se ejecutan en paralelo
 * queden aislados.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');

const dbName = () => `auth_contract_${process.env.JEST_WORKER_ID || '1'}`;

const connect = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: dbName() });
};

const clear = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
};

const disconnect = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};

/**
 * Escribe campos directamente en el documento de cuenta localizado por correo,
 * saltándose la capa de modelo.
 *
 * Es una CONCESIÓN deliberada y está aislada aquí a propósito: la
 * especificación no ofrece ninguna vía para crear un administrador ni para
 * suspender la cuenta de otro sin ser ya administrador, de modo que ciertos
 * escenarios (403 por rol insuficiente, 200 de reactivación) no son alcanzables
 * únicamente con las operaciones publicadas. Se busca por todas las colecciones
 * en lugar de fijar un nombre concreto para no acoplar la suite al modelo
 * actual.
 *
 * @returns {Promise<boolean>} `true` si se actualizó algún documento.
 */
const patchAccountDocument = async (email, fields) => {
  const { db } = mongoose.connection;
  const collections = await db.listCollections().toArray();

  for (const { name } of collections) {
    // eslint-disable-next-line no-await-in-loop
    const result = await db.collection(name).updateOne({ email }, { $set: fields });
    if (result.matchedCount > 0) return true;
  }

  return false;
};

/**
 * Siembra un token de recuperación válido para la cuenta indicada y devuelve su
 * valor en claro.
 *
 * Segunda concesión deliberada, por el mismo motivo que `patchAccountDocument`:
 * el token de recuperación se entrega por correo y la especificación no publica
 * ninguna operación que permita recuperarlo, de modo que el camino feliz de
 * `resetPassword` no es alcanzable sólo con el contrato. El formato de
 * persistencia (SHA-256 del token y marca de caducidad) es un detalle de
 * implementación y queda confinado a esta función.
 */
const plantPasswordResetToken = async (email, { expiresInMs = 10 * 60 * 1000 } = {}) => {
  const token = crypto.randomBytes(32).toString('hex');

  await patchAccountDocument(email, {
    resetPasswordToken: crypto.createHash('sha256').update(token).digest('hex'),
    resetPasswordExpires: new Date(Date.now() + expiresInMs),
  });

  return token;
};

module.exports = {
  connect,
  clear,
  disconnect,
  patchAccountDocument,
  plantPasswordResetToken,
};
