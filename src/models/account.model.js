'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Account — Master Data Holder de la autenticación.
 *
 * El contrato de esta entidad vive en `openapi/auth.yaml`
 * (`components.schemas.Account`); aquí no se duplica.
 *
 * La relación cuenta-usuario es 1:1 en esta versión, pero la propiedad de los
 * recursos se modela contra `accountId` y no contra `userId`, de forma que una
 * futura evolución a cuentas multiusuario no exija migrar los datos.
 */

// NIST SP 800-63B: factor de coste admisible para bcrypt.
const SALT_ROUNDS = 12;

const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

const accountSchema = new mongoose.Schema(
  {
    /** Identificador principal de la cuenta. Único en la colección. */
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
      index: true,
    },

    /**
     * Hash bcrypt de la contraseña. `select: false` garantiza que no se
     * devuelva salvo proyección explícita con `.select('+password')`.
     */
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },

    /**
     * Rol RBAC. `ADMIN` no es asignable desde el registro público: lo siembra
     * un administrador (véase issue #63).
     */
    role: {
      type: String,
      enum: {
        values: ['CUSTOMER', 'ADMIN'],
        message: 'Role must be one of: CUSTOMER, ADMIN',
      },
      default: 'CUSTOMER',
    },

    /**
     * SHA-256 de la API KEY en claro, para búsquedas indexadas en O(1).
     * La clave sólo es visible en la respuesta que la emite.
     */
    apiKeyHash: {
      type: String,
      default: null,
      select: false,
      index: true,
    },

    /**
     * Ciclo de vida de la cuenta. Una cuenta suspendida conserva todos sus
     * datos; sólo se le inhabilita el acceso.
     */
    status: {
      type: String,
      enum: {
        values: ['active', 'suspended'],
        message: 'Status must be one of: active, suspended',
      },
      default: 'active',
    },

    /** SHA-256 del token de recuperación, para acotar el daño de una fuga. */
    resetPasswordToken: {
      type: String,
      select: false,
    },

    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  {
    collection: 'accounts',
    timestamps: true,

    toJSON: {
      versionKey: false,
      transform(_doc, ret) {
        ret.accountId = String(ret._id);
        delete ret._id;
        // Cinturón y tirantes: estos campos nunca salen por serialización.
        delete ret.password;
        delete ret.apiKeyHash;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        return ret;
      },
    },
  },
);

// ---------------------
// HOOK PRE-SAVE — hasheo de contraseña
// ---------------------
/**
 * Hashea `this.password` sólo cuando el campo se ha modificado. Sin la guarda,
 * cualquier `save()` que toque otro campo (rol, estado) volvería a hashear el
 * hash existente y dejaría la cuenta inaccesible.
 */
accountSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

// ---------------------
// MÉTODOS DE INSTANCIA
// ---------------------

/**
 * Compara una contraseña en claro con el hash almacenado.
 * Requiere que el documento se haya cargado con `.select('+password')`.
 *
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
accountSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Genera un token de recuperación, persiste su hash y fija la caducidad.
 *
 * @returns {string} El token en claro, el único valor que puede viajar por
 *   correo. En la base de datos sólo queda su SHA-256.
 */
accountSchema.methods.createPasswordResetToken = function createPasswordResetToken() {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  return resetToken;
};

/**
 * Proyección de la cuenta tal y como la declara el contrato
 * (`components.schemas.Account`).
 *
 * Se construye campo a campo en lugar de filtrar `toJSON()` para que añadir un
 * atributo al esquema no lo publique por descuido en la API.
 *
 * @returns {{accountId: string, email: string, status: string, role: string, createdAt: string}}
 */
accountSchema.methods.toAccount = function toAccount() {
  return {
    accountId: String(this._id),
    email: this.email,
    status: this.status,
    role: this.role,
    createdAt: this.createdAt.toISOString(),
  };
};

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;
