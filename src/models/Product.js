import { DataTypes } from 'sequelize';
import { PRODUCT_UNITS } from '../constants/roles.js';

// SQLite guarda DECIMAL con afinidad numerica y Sequelize lo devuelve como
// string en algunos casos; estos getters normalizan todo a number.
const decimalGetter = (field) => function get() {
  const raw = this.getDataValue(field);
  return raw === null || raw === undefined ? null : Number(raw);
};

export function defineProduct(sequelize) {
  const Product = sequelize.define(
    'Product',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      sku: {
        type: DataTypes.STRING(40),
        allowNull: false,
        validate: { notEmpty: true },
        set(value) {
          this.setDataValue('sku', String(value ?? '').trim().toUpperCase());
        },
      },
      barcode: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(160),
        allowNull: false,
        validate: { notEmpty: true },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      unit: {
        type: DataTypes.ENUM(...PRODUCT_UNITS),
        allowNull: false,
        defaultValue: 'unidad',
      },
      costPrice: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        get: decimalGetter('costPrice'),
      },
      salePrice: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        get: decimalGetter('salePrice'),
      },
      // Stock actual. Lo mantiene el servicio de movimientos dentro de una
      // transaccion; no se deberia escribir a mano desde los controladores.
      quantity: {
        type: DataTypes.DECIMAL(14, 3),
        allowNull: false,
        defaultValue: 0,
        get: decimalGetter('quantity'),
      },
      minStock: {
        type: DataTypes.DECIMAL(14, 3),
        allowNull: true,
        get: decimalGetter('minStock'),
      },
      location: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'products',
      indexes: [
        { unique: true, fields: ['companyId', 'sku'] },
        { fields: ['companyId', 'name'] },
        { fields: ['companyId', 'categoryId'] },
      ],
    },
  );

  return Product;
}
