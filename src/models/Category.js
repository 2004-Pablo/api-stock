import { DataTypes } from 'sequelize';

export function defineCategory(sequelize) {
  return sequelize.define(
    'Category',
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
      name: {
        type: DataTypes.STRING(80),
        allowNull: false,
        validate: { notEmpty: true },
      },
      description: {
        type: DataTypes.STRING(240),
        allowNull: true,
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'categories',
      indexes: [{ unique: true, fields: ['companyId', 'name'] }],
    },
  );
}
