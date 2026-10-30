import { DataTypes } from 'sequelize';
import bcrypt from 'bcryptjs';
import { ROLE_VALUES, ROLES } from '../constants/roles.js';

const SALT_ROUNDS = 10;

export function defineUser(sequelize) {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      // Null solo para super_admin: no pertenece a ninguna empresa.
      companyId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { notEmpty: true },
      },
      email: {
        type: DataTypes.STRING(160),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
        set(value) {
          this.setDataValue('email', String(value ?? '').trim().toLowerCase());
        },
      },
      passwordHash: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM(...ROLE_VALUES),
        allowNull: false,
        defaultValue: ROLES.OPERATOR,
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'users',
      defaultScope: {
        attributes: { exclude: ['passwordHash'] },
      },
      scopes: {
        // Necesario para el login, donde si hace falta el hash.
        withPassword: { attributes: { include: ['passwordHash'] } },
      },
    },
  );

  User.prototype.verifyPassword = function verifyPassword(plainPassword) {
    return bcrypt.compare(plainPassword, this.passwordHash);
  };

  User.hashPassword = function hashPassword(plainPassword) {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
  };

  return User;
}
