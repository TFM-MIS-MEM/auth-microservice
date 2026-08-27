'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Account = require('../models/account.model');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { sendPasswordResetEmail } = require('./email.service');
const config = require('../config');

// 256 bits → 64 caracteres hexadecimales.
const API_KEY_BYTES = 32;

// ---------------------
// AYUDANTES
// ---------------------

/**
 * Genera una API KEY criptográficamente segura. El valor devuelto sólo puede
 * mostrarse una vez: en la base de datos queda únicamente su hash.
 *
 * @returns {string}
 */
const generateRawApiKey = () => crypto.randomBytes(API_KEY_BYTES).toString('hex');

/**
 * Hashea una API KEY con SHA-256, no con bcrypt.
 *
 * La clave es una cadena aleatoria de 256 bits, no una contraseña elegida por
 * una persona: no hay diccionario que atacar, y el hash debe ser determinista
 * para poder localizar la cuenta con una búsqueda indexada en cada petición del
 * canal API.
 *
 * @param {string} rawKey
 * @returns {string}
 */
const hashApiKey = (rawKey) => crypto.createHash('sha256').update(rawKey).digest('hex');

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const normalizeEmail = (email) => email.toLowerCase().trim();

/**
 * Firma el JWT del canal web.
 *
 * Los claims son los mínimos que necesita la pasarela para construir
 * `X-Account-Id` y `X-Role`: `sub` (el `accountId`, claim registrado por
 * RFC 7519 para el sujeto) y `role`. El correo no viaja en el token porque
 * ningún consumidor lo necesita y sería un dato personal circulando por un
 * canal máquina a máquina.
 *
 * @param {{ accountId: string, role: string }} claims
 * @returns {{ token: string, expiresIn: number }} El token y su vigencia en
 *   segundos, leída del propio token para que no pueda divergir de él.
 */
const signJwt = ({ accountId, role }) => {
  if (!config.jwtSecret) {
    throw new AppError('JWT secret is not configured', 500, 'INTERNAL_ERROR');
  }

  const token = jwt.sign({ role }, config.jwtSecret, {
    subject: accountId,
    expiresIn: config.jwtExpiresIn,
    issuer: 'auth-microservice',
  });

  const { iat, exp } = jwt.decode(token);

  return { token, expiresIn: exp - iat };
};

// ---------------------
// SERVICIO — Registro
// ---------------------
/**
 * STATE CREATION OPERATION: crea una cuenta.
 *
 * El rol se asigna siempre como `CUSTOMER`. La firma no acepta `role`
 * precisamente para que no exista ninguna vía por la que un dato del cuerpo de
 * la petición pueda acabar determinándolo.
 *
 * @param {{ email: string, password: string }} dto
 * @returns {Promise<{accountId: string, email: string, apiKey: string}>}
 * @throws {AppError} 409 si el correo ya está registrado.
 */
const register = async ({ email, password }) => {
  const existing = await Account.findOne({ email: normalizeEmail(email) });
  if (existing) {
    throw new AppError(
      'An account with this email already exists',
      409,
      'EMAIL_ALREADY_REGISTERED',
    );
  }

  const rawApiKey = generateRawApiKey();

  const account = await Account.create({
    email,
    password,
    role: 'CUSTOMER',
    apiKeyHash: hashApiKey(rawApiKey),
  });

  return {
    accountId: String(account._id),
    email: account.email,
    apiKey: rawApiKey,
  };
};

// ---------------------
// SERVICIO — Inicio de sesión
// ---------------------
/**
 * RETRIEVAL OPERATION: valida las credenciales y emite un JWT.
 *
 * Una cuenta suspendida no obtiene token. La ventana de revocación documentada
 * afecta a los tokens ya emitidos, que siguen verificando por firma hasta
 * caducar; si además se pudiera pedir uno nuevo, la suspensión no tendría
 * ningún efecto sobre el canal web.
 *
 * @param {{ email: string, password: string }} dto
 * @returns {Promise<{token: string, expiresIn: number}>}
 * @throws {AppError} 401 credenciales inválidas · 403 cuenta suspendida.
 */
const login = async ({ email, password }) => {
  const account = await Account.findOne({ email: normalizeEmail(email) }).select('+password');

  // Mensaje único para los dos casos: distinguir «no existe» de «contraseña
  // incorrecta» convertiría el login en un oráculo de enumeración.
  const invalidCredentials = () => new AppError('Invalid email or password', 401, 'UNAUTHORIZED');

  if (!account) throw invalidCredentials();

  const isMatch = await account.comparePassword(password);
  if (!isMatch) throw invalidCredentials();

  if (account.status !== 'active') {
    throw new AppError('This account is suspended', 403, 'ACCOUNT_SUSPENDED');
  }

  return signJwt({ accountId: String(account._id), role: account.role });
};

// ---------------------
// SERVICIO — Recuperación de contraseña
// ---------------------
/**
 * STATE CREATION OPERATION: inicia la recuperación de contraseña.
 *
 * No lanza nunca. La operación responde lo mismo exista o no la cuenta, para no
 * ofrecer un oráculo de enumeración de usuarios registrados, y por eso tampoco
 * puede propagar un fallo de envío de correo: el error se registra y la
 * respuesta sigue siendo la misma.
 *
 * Sobre el tiempo de respuesta: la comprobación se ejecuta siempre —no hay
 * cortocircuito previo—, y el envío del correo, que es el coste dominante,
 * queda fuera del camino de la respuesta. Persiste una diferencia residual de
 * una escritura entre el caso «la cuenta existe» y el caso contrario; igualarla
 * exigiría escrituras señuelo y no se ha considerado justificado.
 *
 * @param {string} email
 * @returns {Promise<void>}
 */
const forgotPassword = async (email) => {
  const account = await Account.findOne({ email: normalizeEmail(email) });

  if (!account) return;

  const resetToken = account.createPasswordResetToken();
  await account.save({ validateBeforeSave: false });

  try {
    await sendPasswordResetEmail(account.email, resetToken);
  } catch (err) {
    // El token queda sembrado y caducará solo: revertirlo aquí abriría una
    // diferencia de tiempo observable entre las dos ramas.
    logger.error(`Password reset email could not be sent: ${err.message}`);
  }
};

/**
 * STATE TRANSITION OPERATION: fija la nueva contraseña.
 *
 * @param {string} token Token en claro recibido por correo.
 * @param {string} newPassword
 * @returns {Promise<void>}
 * @throws {AppError} 400 si el token no existe o ha caducado.
 */
const resetPassword = async (token, newPassword) => {
  const account = await Account.findOne({
    resetPasswordToken: hashResetToken(token),
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!account) {
    throw new AppError('Token is invalid or has expired', 400, 'INVALID_RESET_TOKEN');
  }

  account.password = newPassword;
  account.resetPasswordToken = undefined;
  account.resetPasswordExpires = undefined;

  await account.save();
};

// ---------------------
// SERVICIO — Credenciales
// ---------------------
/**
 * STATE TRANSITION OPERATION: cambia una contraseña conocida.
 *
 * @param {string} accountId
 * @param {string} oldPassword
 * @param {string} newPassword
 * @returns {Promise<void>}
 * @throws {AppError} 401 si la contraseña anterior no es correcta.
 */
const changePassword = async (accountId, oldPassword, newPassword) => {
  const account = await Account.findById(accountId).select('+password');
  if (!account) {
    throw new AppError('Account not found', 401, 'UNAUTHORIZED');
  }

  const isMatch = await account.comparePassword(oldPassword);
  if (!isMatch) {
    throw new AppError('The old password is not correct', 401, 'UNAUTHORIZED');
  }

  account.password = newPassword;
  await account.save();
};

/**
 * STATE TRANSITION OPERATION: rota la API KEY, invalidando la anterior.
 *
 * El orden de comprobaciones es deliberado: primero la contraseña de
 * confirmación (401) y después el estado de la cuenta (403). El contrato
 * considera la confirmación parte de la autenticación de la operación, y la
 * autenticación precede a la autorización.
 *
 * @param {string} accountId
 * @param {string} password Contraseña de confirmación.
 * @returns {Promise<string>} La nueva API KEY en claro, visible sólo aquí.
 * @throws {AppError} 401 confirmación incorrecta · 403 cuenta suspendida.
 */
const rotateKey = async (accountId, password) => {
  const account = await Account.findById(accountId).select('+password');
  if (!account) {
    throw new AppError('Account not found', 401, 'UNAUTHORIZED');
  }

  await assertPasswordConfirmation(account, password);
  assertNotSuspended(account);

  const rawApiKey = generateRawApiKey();
  account.apiKeyHash = hashApiKey(rawApiKey);
  await account.save();

  return rawApiKey;
};

// ---------------------
// SERVICIO — Ciclo de vida de la cuenta
// ---------------------
/**
 * RETRIEVAL OPERATION: devuelve la cuenta autenticada.
 *
 * @param {string} accountId
 * @returns {Promise<object>} La cuenta en la forma que declara el contrato.
 * @throws {AppError} 401 si la cuenta ya no existe.
 */
const getAccount = async (accountId) => {
  const account = await Account.findById(accountId);
  if (!account) {
    throw new AppError('Account not found', 401, 'UNAUTHORIZED');
  }

  return account.toAccount();
};

/**
 * STATE TRANSITION OPERATION: suspende la cuenta del solicitante.
 *
 * La reactivación no es posible por esta vía: exige un administrador.
 *
 * @param {string} accountId
 * @returns {Promise<void>}
 * @throws {AppError} 409 si la cuenta ya estaba suspendida.
 */
const suspendOwnAccount = async (accountId) => {
  const account = await Account.findById(accountId);
  if (!account) {
    throw new AppError('Account not found', 401, 'UNAUTHORIZED');
  }

  if (account.status === 'suspended') {
    throw new AppError('This account is already suspended', 409, 'ACCOUNT_ALREADY_SUSPENDED');
  }

  account.status = 'suspended';
  await account.save();
};

/**
 * STATE TRANSITION OPERATION: cambia el estado de una cuenta ajena.
 * Única vía de reactivación; reservada al rol `ADMIN`.
 *
 * @param {string} accountId
 * @param {'active'|'suspended'} status
 * @returns {Promise<void>}
 * @throws {AppError} 404 si la cuenta indicada no existe.
 */
const setAccountStatus = async (accountId, status) => {
  const account = await Account.findById(accountId);
  if (!account) {
    throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND');
  }

  account.status = status;
  await account.save();
};

/**
 * STATE TRANSITION OPERATION: elimina la cuenta (derecho de supresión, RGPD).
 *
 * Mismo orden que en la rotación de clave: confirmación (401) antes que estado
 * (403).
 *
 * @param {string} accountId
 * @param {string} password Contraseña de confirmación.
 * @returns {Promise<void>}
 * @throws {AppError} 401 confirmación incorrecta · 403 cuenta suspendida.
 */
const deleteAccount = async (accountId, password) => {
  const account = await Account.findById(accountId).select('+password');
  if (!account) {
    throw new AppError('Account not found', 401, 'UNAUTHORIZED');
  }

  await assertPasswordConfirmation(account, password);
  assertNotSuspended(account);

  await Account.deleteOne({ _id: account._id });

  // TODO(#31): publicar `account.deleted` en Kafka. `fr-commercial` purga en
  // cascada y `pricing` cancela la suscripción en Stripe.
};

// ---------------------
// SERVICIO — Validación de API KEY (interno)
// ---------------------
/**
 * RETRIEVAL OPERATION: valida una API KEY para la pasarela.
 *
 * Devuelve el `accountId` además del veredicto: sin él la pasarela no puede
 * propagar `X-Account-Id` y `fr-commercial` no puede determinar la propiedad de
 * las galerías.
 *
 * Una cuenta suspendida NO es un error aquí: se responde 200 con
 * `status: "suspended"` y es la pasarela quien decide. No se devuelve el correo:
 * es un canal máquina a máquina y nadie lo necesita.
 *
 * @param {string} rawApiKey
 * @returns {Promise<{valid: true, accountId: string, status: string, role: string}>}
 * @throws {AppError} 401 si la clave no corresponde a ninguna cuenta.
 */
const validateKey = async (rawApiKey) => {
  // La cabecera puede faltar: sin clave que validar no hay nada que consultar.
  const account = rawApiKey ? await Account.findOne({ apiKeyHash: hashApiKey(rawApiKey) }) : null;

  if (!account) {
    throw new AppError('Invalid API Key', 401, 'INVALID_API_KEY');
  }

  return {
    valid: true,
    accountId: String(account._id),
    status: account.status,
    role: account.role,
  };
};

// ---------------------
// GUARDAS COMPARTIDAS
// ---------------------

/**
 * Comprueba la contraseña de confirmación de una operación destructiva.
 * El contrato no declara 400 en estas operaciones, de modo que una contraseña
 * ausente y una incorrecta se tratan igual.
 */
async function assertPasswordConfirmation(account, password) {
  const isMatch = typeof password === 'string' && (await account.comparePassword(password));

  if (!isMatch) {
    throw new AppError(
      'Password confirmation is missing or incorrect',
      401,
      'INVALID_PASSWORD_CONFIRMATION',
    );
  }
}

function assertNotSuspended(account) {
  if (account.status !== 'active') {
    throw new AppError('This account is suspended', 403, 'ACCOUNT_SUSPENDED');
  }
}

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  rotateKey,
  getAccount,
  suspendOwnAccount,
  setAccountStatus,
  deleteAccount,
  validateKey,
};
