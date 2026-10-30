import { DataTypes } from 'sequelize';
import { MOVEMENT_TYPE_VALUES } from '../constants/roles.js';

const decimalGetter = (field) => function get() {
  const raw = this.getDataValue(field);
  return raw === null || raw === undefined ? null : Number(raw);
};

export function defineStockMovement(sequelize) {
  return sequelize.define(
    'StockMovement',
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
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      // Quien registro el movimiento. Los usuarios se dan de baja logica,
      // nunca se borran, asi que la auditoria no pierde el autor.
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM(...MOVEMENT_TYPE_VALUES),
        allowNull: false,
      },
      // Lo que cargo el usuario: cantidad de la entrada/salida, o el conteo
      // final en el caso de un ajuste.
      quantity: {
        type: DataTypes.DECIMAL(14, 3),
        allowNull: false,
        get: decimalGetter('quantity'),
      },
      // Variacion con signo que realmente se aplico al stock.
      delta: {
        type: DataTypes.DECIMAL(14, 3),
        allowNull: false,
        get: decimalGetter('delta'),
      },
      quantityBefore: {
        type: DataTypes.DECIMAL(14, 3),
        allowNull: false,
        get: decimalGetter('quantityBefore'),
      },
      quantityAfter: {
        type: DataTypes.DECIMAL(14, 3),
        allowNull: false,
        get: decimalGetter('quantityAfter'),
      },
      unitCost: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        get: decimalGetter('unitCost'),
      },
      reason: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      // Numero de remito, factura, orden interna, etc.
      reference: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'stock_movements',
      // Los movimientos son un registro de auditoria: no se editan ni borran.
      updatedAt: false,
      indexes: [
        { fields: ['companyId', 'createdAt'] },
        { fields: ['productId', 'createdAt'] },
        { fields: ['companyId', 'type'] },
      ],
    },
  );
}
