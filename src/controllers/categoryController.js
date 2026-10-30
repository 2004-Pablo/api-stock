import { Op } from 'sequelize';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { Category, Product } from '../models/index.js';
import { buildPage, parsePagination } from '../utils/pagination.js';

export const listCategories = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const where = { companyId: req.companyId };

  if (req.query.search) where.name = { [Op.like]: `%${req.query.search}%` };
  if (req.query.active !== undefined) where.active = req.query.active;

  const { rows, count } = await Category.findAndCountAll({
    where,
    order: [['name', 'ASC']],
    limit,
    offset,
  });

  res.json(buildPage({ rows, count, page, limit }));
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create({ ...req.body, companyId: req.companyId });
  res.status(201).json({ data: category });
});

export const getCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({
    where: { id: req.params.id, companyId: req.companyId },
  });
  if (!category) throw ApiError.notFound('La categoria no existe');
  res.json({ data: category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({
    where: { id: req.params.id, companyId: req.companyId },
  });
  if (!category) throw ApiError.notFound('La categoria no existe');

  await category.update(req.body);
  res.json({ data: category });
});

// Baja logica: si la categoria tiene productos, desactivarla evita dejarlos
// sin referencia.
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({
    where: { id: req.params.id, companyId: req.companyId },
  });
  if (!category) throw ApiError.notFound('La categoria no existe');

  const productCount = await Product.count({
    where: { categoryId: category.id, companyId: req.companyId },
  });

  if (productCount > 0) {
    await category.update({ active: false });
    return res.json({
      data: category,
      message: `La categoria tiene ${productCount} producto(s), se desactivo en lugar de borrarse`,
    });
  }

  await category.destroy();
  return res.status(204).send();
});
