import { Transaction } from 'sequelize';
import { sequelize, Product, StockMovement, User, Category } from '../models/index.js';
import { MOVEMENT_TYPES } from '../constants/roles.js';
import { ApiError } from '../utils/ApiError.js';
import { DEFAULT_COMPANY_SETTINGS } from '../models/Company.js';

// Las cantidades se guardan con 3 decimales (para kg, litros, etc.).
const round = (value) => Math.round(value * 1000) / 1000;

function computeDelta({ type, quantity, current }) {
  switch (type) {
    case MOVEMENT_TYPES.IN:
      return round(quantity);
    case MOVEMENT_TYPES.OUT:
      return round(-quantity);
    case MOVEMENT_TYPES.ADJUSTMENT:
      // En un ajuste la cantidad enviada es el conteo final real.
      return round(quantity - current);
    default:
      throw ApiError.badRequest(`Tipo de movimiento desconocido: ${type}`);
  }
}

// Aplica un movimiento sobre un producto dentro de una transaccion ya abierta.
// Lee el stock, calcula la variacion, valida el resultado y guarda producto y
// movimiento juntos, de modo que el stock y su auditoria no puedan quedar
// desincronizados.
async function applyMovementInTransaction(
  { companyId, userId, productId, type, quantity, unitCost, reason, reference, notes, settings },
  transaction,
) {
  const product = await Product.findOne({
    where: { id: productId, companyId },
    transaction,
  });

  if (!product) throw ApiError.notFound('El producto no existe en esta empresa');
  if (!product.active) {
    throw ApiError.badRequest('El producto esta desactivado: reactivalo antes de mover stock');
  }

  const quantityBefore = round(product.quantity ?? 0);
  const delta = computeDelta({ type, quantity, current: quantityBefore });

  if (delta === 0) {
    throw ApiError.badRequest('El movimiento no cambia el stock actual');
  }

  const quantityAfter = round(quantityBefore + delta);
  const allowNegative = settings?.allowNegativeStock ?? DEFAULT_COMPANY_SETTINGS.allowNegativeStock;

  if (quantityAfter < 0 && !allowNegative) {
    throw ApiError.badRequest(
      `Stock insuficiente: hay ${quantityBefore} y se intenta egresar ${quantity}`,
    );
  }

  product.quantity = quantityAfter;
  await product.save({ transaction });

  const movement = await StockMovement.create(
    {
      companyId,
      productId,
      userId,
      type,
      quantity: round(quantity),
      delta,
      quantityBefore,
      quantityAfter,
      unitCost: unitCost ?? null,
      reason: reason ?? null,
      reference: reference ?? null,
      notes: notes ?? null,
    },
    { transaction },
  );

  return { movement, product };
}

// SQLite no tiene SELECT ... FOR UPDATE: una transaccion IMMEDIATE toma el
// lock de escritura al abrirse y evita que dos movimientos simultaneos lean
// el mismo stock y se pisen.
export async function registerMovement(input) {
  return sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE }, async (transaction) => {
    const { movement } = await applyMovementInTransaction(input, transaction);
    return movement;
  });
}

// Varios movimientos en un solo lote: o entran todos o no entra ninguno.
export async function registerMovementBatch({ companyId, userId, settings, reference, reason, items }) {
  return sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE }, async (transaction) => {
    const results = [];
    for (const [index, item] of items.entries()) {
      try {
        const { movement } = await applyMovementInTransaction(
          { ...item, companyId, userId, settings, reference, reason },
          transaction,
        );
        results.push(movement);
      } catch (error) {
        if (error instanceof ApiError) {
          throw new ApiError(error.status, `Item ${index + 1}: ${error.message}`, error.details);
        }
        throw error;
      }
    }
    return results;
  });
}

// Crea el producto y, si trae stock inicial, su movimiento de apertura, todo
// en la misma transaccion.
export async function createProductWithInitialStock({ companyId, userId, data, initialQuantity }) {
  return sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE }, async (transaction) => {
    const product = await Product.create(
      { ...data, companyId, quantity: 0 },
      { transaction },
    );

    if (initialQuantity > 0) {
      await applyMovementInTransaction(
        {
          companyId,
          userId,
          productId: product.id,
          type: MOVEMENT_TYPES.IN,
          quantity: initialQuantity,
          unitCost: data.costPrice ?? null,
          reason: 'Carga inicial',
          settings: { allowNegativeStock: true },
        },
        transaction,
      );
      await product.reload({ transaction });
    }

    return product;
  });
}

export const movementIncludes = [
  { model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'unit'] },
  { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
];

export const productIncludes = [
  { model: Category, as: 'category', attributes: ['id', 'name'] },
];
