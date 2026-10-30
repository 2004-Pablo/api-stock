import { Op, literal } from 'sequelize';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { Category, Product, StockMovement } from '../models/index.js';
import { buildPage, parsePagination } from '../utils/pagination.js';
import { createProductWithInitialStock, movementIncludes, productIncludes } from '../services/stockService.js';
import { DEFAULT_COMPANY_SETTINGS } from '../models/Company.js';

function companyDefaultMinStock(req) {
  return req.company?.settings?.defaultMinStock ?? DEFAULT_COMPANY_SETTINGS.defaultMinStock;
}

// Marca cada producto con su estado de stock para que el frontend no tenga
// que repetir la regla del umbral.
function withStockStatus(product, defaultMinStock) {
  const plain = product.toJSON ? product.toJSON() : product;
  const threshold = plain.minStock ?? defaultMinStock;
  let status = 'ok';
  if (plain.quantity <= 0) status = 'out';
  else if (plain.quantity <= threshold) status = 'low';
  return { ...plain, effectiveMinStock: threshold, stockStatus: status };
}

export const listProducts = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { search, categoryId, active, lowStock, sortBy, sortDir } = req.query;
  const defaultMinStock = companyDefaultMinStock(req);

  const where = { companyId: req.companyId };
  if (categoryId) where.categoryId = categoryId;
  if (active !== undefined) where.active = active;

  if (search) {
    const pattern = `%${search}%`;
    where[Op.or] = [
      { name: { [Op.like]: pattern } },
      { sku: { [Op.like]: pattern } },
      { barcode: { [Op.like]: pattern } },
    ];
  }

  // Stock bajo: compara contra el minimo del producto o, si no tiene, contra
  // el valor por defecto de la empresa.
  if (lowStock) {
    where[Op.and] = [
      ...(where[Op.and] ?? []),
      literal('`Product`.`quantity` <= COALESCE(`Product`.`minStock`, ' + Number(defaultMinStock) + ')'),
    ];
  }

  const { rows, count } = await Product.findAndCountAll({
    where,
    include: productIncludes,
    order: [[sortBy ?? 'name', (sortDir ?? 'asc').toUpperCase()]],
    limit,
    offset,
  });

  res.json(
    buildPage({
      rows: rows.map((row) => withStockStatus(row, defaultMinStock)),
      count,
      page,
      limit,
    }),
  );
});

export const createProduct = asyncHandler(async (req, res) => {
  const { initialQuantity, ...data } = req.body;

  if (data.categoryId) {
    const category = await Category.findOne({
      where: { id: data.categoryId, companyId: req.companyId },
    });
    if (!category) throw ApiError.badRequest('La categoria indicada no existe en esta empresa');
  }

  const duplicate = await Product.findOne({
    where: { companyId: req.companyId, sku: String(data.sku).trim().toUpperCase() },
  });
  if (duplicate) throw ApiError.conflict(`Ya existe un producto con el SKU ${duplicate.sku}`);

  const product = await createProductWithInitialStock({
    companyId: req.companyId,
    userId: req.user.id,
    data,
    initialQuantity: initialQuantity ?? 0,
  });

  const created = await Product.findByPk(product.id, { include: productIncludes });
  res.status(201).json({ data: withStockStatus(created, companyDefaultMinStock(req)) });
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    where: { id: req.params.id, companyId: req.companyId },
    include: productIncludes,
  });
  if (!product) throw ApiError.notFound('El producto no existe');
  res.json({ data: withStockStatus(product, companyDefaultMinStock(req)) });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    where: { id: req.params.id, companyId: req.companyId },
  });
  if (!product) throw ApiError.notFound('El producto no existe');

  if (req.body.categoryId) {
    const category = await Category.findOne({
      where: { id: req.body.categoryId, companyId: req.companyId },
    });
    if (!category) throw ApiError.badRequest('La categoria indicada no existe en esta empresa');
  }

  // El stock solo cambia por movimientos, nunca por un PATCH del producto.
  const { quantity, companyId, ...changes } = req.body;
  await product.update(changes);

  const updated = await Product.findByPk(product.id, { include: productIncludes });
  res.json({ data: withStockStatus(updated, companyDefaultMinStock(req)) });
});

// Baja logica. Un producto con historial de movimientos no se borra para no
// perder la auditoria.
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    where: { id: req.params.id, companyId: req.companyId },
  });
  if (!product) throw ApiError.notFound('El producto no existe');

  await product.update({ active: false });
  res.json({ data: product, message: 'Producto desactivado' });
});

export const listProductMovements = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);

  const product = await Product.findOne({
    where: { id: req.params.id, companyId: req.companyId },
  });
  if (!product) throw ApiError.notFound('El producto no existe');

  const { rows, count } = await StockMovement.findAndCountAll({
    where: { productId: product.id, companyId: req.companyId },
    include: movementIncludes,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  res.json(buildPage({ rows, count, page, limit }));
});
