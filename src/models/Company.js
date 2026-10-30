import { DataTypes } from 'sequelize';

export const DEFAULT_COMPANY_SETTINGS = {
  currency: 'ARS',
  timezone: 'America/Argentina/Buenos_Aires',
  // Umbral de stock bajo que se usa cuando un producto no define el suyo.
  defaultMinStock: 5,
  // Si es false, un egreso no puede dejar el stock por debajo de cero.
  allowNegativeStock: false,
};

export function defineCompany(sequelize) {
  return sequelize.define(
    'Company',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { notEmpty: true },
      },
      slug: {
        type: DataTypes.STRING(60),
        allowNull: false,
        unique: true,
      },
      taxId: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(160),
        allowNull: true,
        validate: { isEmail: true },
      },
      phone: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      address: {
        type: DataTypes.STRING(240),
        allowNull: true,
      },
      settings: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: DEFAULT_COMPANY_SETTINGS,
        get() {
          // Garantiza que falte una clave nueva no rompa el frontend.
          const raw = this.getDataValue('settings') ?? {};
          return { ...DEFAULT_COMPANY_SETTINGS, ...raw };
        },
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'companies',
    },
  );
}
