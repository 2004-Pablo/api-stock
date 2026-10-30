import { Op, fn, col, literal } from 'sequelize';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Category, Product, StockMovement } from '../models/index.js';
import { MOVEMENT_TYPES } from '../constants/roles.js';
import { DEFAULT_COMPANY_SETTINGS } from '../models/Company.js';
import { productIncludes } from '../services/stockService.js';
import {
  localDayKeys,
  sqliteTzModifier,
  startOfLocalDaysAgo,
  tzOffsetMinutes,
} from '../utils/time.js';

const num = (value) => Number(value ?? 0);
const round2 = (value) => Math.round(num(value) * 100) / 100;

function defaultMinStockOf(req) {
  return Number(req.company?.settings?.defaultMinStock ?? DEFAULT_COMPANY_SETTINGS.defaultMinStock);
}

// Los dias se cuentan en la zona horaria configurada por la empresa, no en la
// del servidor ni en UTC.
function timezoneOffsetOf(req) {
  const timezone = req.company?.settings?.timezone ?? DEFAULT_COMPANY_SETTINGS.timezone;
  return tzOffsetMinutes(timezone);
}

// Condicion de stock bajo calificada con el alias de la tabla, para que sirva
// tambien en consultas con include.
function lowStockCondition(threshold, alias) {
  const column = alias ? '`' + alias + '`.`quantity`' : 'quantity';
  const minColumn = alias ? '`' + alias + '`.`minStock`' : 'minStock';
  return `${column} <= COALESCE(${minColumn}, ${Number(threshold)})`;
}

// Resumen de cabecera del dashboard: totales de catalogo, valorizacion del
// inventario y actividad reciente.
export const getSummary = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const threshold = defaultMinStockOf(req);
  const startOfToday = startOfLocalDaysAgo(1, timezoneOffsetOf(req));

  const [totals] = await Product.findAll({
    where: { companyId, active: true },
    attributes: [
      [fn('COUNT', col('id')), 'productCount'],
      [fn('COALESCE', fn('SUM', col('quantity')), 0), 'totalUnits'],
      [fn('COALESCE', fn('SUM', literal('quantity * costPrice')), 0), 'inventoryCostValue'],
      [fn('COALESCE', fn('SUM', literal('quantity * salePrice')), 0), 'inventorySaleValue'],
    ],
    raw: true,
  });

  const [lowStockCount, outOfStockCount, inactiveCount, categoryCount, movementsToday] =
    await Promise.all([
      Product.count({
        where: {
          companyId,
          active: true,
          quantity: { [Op.gt]: 0 },
          [Op.and]: [literal(lowStockCondition(threshold))],
        },
      }),
      Product.count({ where: { companyId, active: true, quantity: { [Op.lte]: 0 } } }),
      Product.count({ where: { companyId, active: false } }),
      Category.count({ where: { companyId, active: true } }),
      StockMovement.count({ where: { companyId, createdAt: { [Op.gte]: startOfToday } } }),
    ]);

  const costValue = round2(totals.inventoryCostValue);
  const saleValue = round2(totals.inventorySaleValue);

  res.json({
    data: {
      productCount: num(totals.productCount),
      categoryCount,
      totalUnits: round2(totals.totalUnits),
      inventoryCostValue: costValue,
      inventorySaleValue: saleValue,
      // Margen potencial si se vendiera todo el stock al precio de lista.
      potentialMargin: round2(saleValue - costValue),
      lowStockCount,
      outOfStockCount,
      inactiveProductCount: inactiveCount,
      movementsToday,
      currency: req.company?.settings?.currency ?? DEFAULT_COMPANY_SETTINGS.currency,
    },
  });
});

// Productos que necesitan reposicion, los mas urgentes primero.
export const getLowStock = asyncHandler(async (req, res) => {
  const threshold = defaultMinStockOf(req);
  const limit = req.query.limit ?? 10;

  const products = await Product.findAll({
    where: {
      companyId: req.companyId,
      active: true,
      [Op.and]: [literal(lowStockCondition(threshold, 'Product'))],
    },
    include: productIncludes,
    order: [
      ['quantity', 'ASC'],
      ['name', 'ASC'],
    ],
    limit,
  });

  res.json({
    data: products.map((product) => {
      const plain = product.toJSON();
      const minStock = plain.minStock ?? threshold;
      return {
        ...plain,
        effectiveMinStock: minStock,
        missingUnits: round2(Math.max(0, minStock - plain.quantity)),
        stockStatus: plain.quantity <= 0 ? 'out' : 'low',
      };
    }),
  });
});

// Serie diaria de entradas y salidas para graficar la evolucion del stock.
export const getMovementsTimeseries = asyncHandler(async (req, res) => {
  const days = req.query.days ?? 30;
  const offset = timezoneOffsetOf(req);
  const since = startOfLocalDaysAgo(days, offset);
  // date() agrupa en UTC; el modificador lo corre a la zona de la empresa para
  // que los dias coincidan con los que se piden en el where.
  const dayExpression = fn('date', col('createdAt'), sqliteTzModifier(offset));

  const rows = await StockMovement.findAll({
    where: { companyId: req.companyId, createdAt: { [Op.gte]: since } },
    attributes: [
      [dayExpression, 'day'],
      'type',
      [fn('COUNT', col('id')), 'count'],
      [fn('COALESCE', fn('SUM', fn('ABS', col('delta'))), 0), 'units'],
    ],
    group: [dayExpression, 'type'],
    raw: true,
  });

  // Se rellenan los dias sin movimientos para que el grafico no tenga huecos.
  const buckets = new Map();
  for (const key of localDayKeys(days, offset)) {
    buckets.set(key, { day: key, in: 0, out: 0, adjustment: 0, movements: 0 });
  }

  for (const row of rows) {
    const bucket = buckets.get(row.day);
    if (!bucket) continue;
    bucket[row.type] = round2(row.units);
    bucket.movements += num(row.count);
  }

  res.json({ data: [...buckets.values()] });
});

// Productos con mas rotacion en el periodo, medidos por unidades egresadas.
export const getTopProducts = asyncHandler(async (req, res) => {
  const days = req.query.days ?? 30;
  const limit = req.query.limit ?? 10;
  const since = startOfLocalDaysAgo(days, timezoneOffsetOf(req));

  const rows = await StockMovement.findAll({
    where: {
      companyId: req.companyId,
      type: MOVEMENT_TYPES.OUT,
      createdAt: { [Op.gte]: since },
    },
    attributes: [
      'productId',
      [fn('COALESCE', fn('SUM', fn('ABS', col('delta'))), 0), 'unitsOut'],
      [fn('COUNT', col('StockMovement.id')), 'movements'],
    ],
    include: [
      { model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'unit', 'quantity'] },
    ],
    group: ['StockMovement.productId', 'product.id'],
    order: [[literal('unitsOut'), 'DESC']],
    limit,
  });

  res.json({
    data: rows.map((row) => {
      const plain = row.toJSON();
      return {
        productId: plain.productId,
        sku: plain.product?.sku ?? null,
        name: plain.product?.name ?? null,
        unit: plain.product?.unit ?? null,
        currentQuantity: plain.product?.quantity ?? null,
        unitsOut: round2(plain.unitsOut),
        movements: num(plain.movements),
      };
    }),
  });
});

// Valorizacion del inventario agrupada por categoria.
export const getStockByCategory = asyncHandler(async (req, res) => {
  const products = await Product.findAll({
    where: { companyId: req.companyId, active: true },
    include: productIncludes,
    attributes: ['id', 'categoryId', 'quantity', 'costPrice'],
  });

  const groups = new Map();
  for (const product of products) {
    const plain = product.toJSON();
    const key = plain.categoryId ?? 'sin-categoria';
    if (!groups.has(key)) {
      groups.set(key, {
        categoryId: plain.categoryId ?? null,
        name: plain.category?.name ?? 'Sin categoria',
        productCount: 0,
        totalUnits: 0,
        costValue: 0,
      });
    }
    const group = groups.get(key);
    group.productCount += 1;
    group.totalUnits += num(plain.quantity);
    group.costValue += num(plain.quantity) * num(plain.costPrice);
  }

  const data = [...groups.values()]
    .map((group) => ({
      ...group,
      totalUnits: round2(group.totalUnits),
      costValue: round2(group.costValue),
    }))
    .sort((a, b) => b.costValue - a.costValue);

  res.json({ data });
});
