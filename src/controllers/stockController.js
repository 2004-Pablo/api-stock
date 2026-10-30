import { Op } from 'sequelize';
import { asyncHandler } from '../utils/asyncHandler.js';
import { StockMovement } from '../models/index.js';
import { buildPage, parsePagination } from '../utils/pagination.js';
import { movementIncludes, registerMovement, registerMovementBatch } from '../services/stockService.js';
import { startOfLocalDaysAgo, tzOffsetMinutes } from '../utils/time.js';
import { DEFAULT_COMPANY_SETTINGS } from '../models/Company.js';

export const listMovements = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { productId, userId, type, from, to, days, search } = req.query;

  const where = { companyId: req.companyId };
  if (productId) where.productId = productId;
  if (userId) where.userId = userId;
  if (type) where.type = type;

  // `days` es un atajo: se traduce a la medianoche local de hace N dias en la
  // zona horaria de la empresa. Un `from` explicito tiene prioridad.
  let since = from;
  if (!since && days) {
    const timezone = req.company?.settings?.timezone ?? DEFAULT_COMPANY_SETTINGS.timezone;
    since = startOfLocalDaysAgo(days, tzOffsetMinutes(timezone));
  }

  if (since || to) {
    where.createdAt = {};
    if (since) where.createdAt[Op.gte] = since;
    if (to) where.createdAt[Op.lte] = to;
  }

  if (search) {
    const pattern = `%${search}%`;
    where[Op.or] = [
      { reference: { [Op.like]: pattern } },
      { reason: { [Op.like]: pattern } },
      { notes: { [Op.like]: pattern } },
    ];
  }

  const { rows, count } = await StockMovement.findAndCountAll({
    where,
    include: movementIncludes,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  res.json(buildPage({ rows, count, page, limit }));
});

export const createMovement = asyncHandler(async (req, res) => {
  const movement = await registerMovement({
    ...req.body,
    companyId: req.companyId,
    userId: req.user.id,
    settings: req.company?.settings,
  });

  const created = await StockMovement.findByPk(movement.id, { include: movementIncludes });
  res.status(201).json({ data: created });
});

// Carga por lote: util para recibir un remito completo de una sola vez.
export const createMovementBatch = asyncHandler(async (req, res) => {
  const movements = await registerMovementBatch({
    companyId: req.companyId,
    userId: req.user.id,
    settings: req.company?.settings,
    reference: req.body.reference,
    reason: req.body.reason,
    items: req.body.items,
  });

  const created = await StockMovement.findAll({
    where: { id: movements.map((movement) => movement.id) },
    include: movementIncludes,
    order: [['createdAt', 'ASC']],
  });

  res.status(201).json({ data: created, meta: { created: created.length } });
});

export const getMovement = asyncHandler(async (req, res) => {
  const movement = await StockMovement.findOne({
    where: { id: req.params.id, companyId: req.companyId },
    include: movementIncludes,
  });
  if (!movement) {
    return res.status(404).json({ error: { message: 'El movimiento no existe' } });
  }
  return res.json({ data: movement });
});
