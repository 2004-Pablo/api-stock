import { Op } from 'sequelize';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/index.js';
import { buildPage, parsePagination } from '../utils/pagination.js';
import { ROLES, ROLE_LABELS } from '../constants/roles.js';

const serialize = (user) => ({
  ...user.toJSON(),
  roleLabel: ROLE_LABELS[user.role],
});

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const where = { companyId: req.companyId };

  if (req.query.role) where.role = req.query.role;
  if (req.query.active !== undefined) where.active = req.query.active;
  if (req.query.search) {
    const pattern = `%${req.query.search}%`;
    where[Op.or] = [{ name: { [Op.like]: pattern } }, { email: { [Op.like]: pattern } }];
  }

  const { rows, count } = await User.findAndCountAll({
    where,
    order: [['name', 'ASC']],
    limit,
    offset,
  });

  res.json(buildPage({ rows: rows.map(serialize), count, page, limit }));
});

export const createUser = asyncHandler(async (req, res) => {
  const { password, ...data } = req.body;

  const existing = await User.findOne({ where: { email: data.email } });
  if (existing) throw ApiError.conflict('Ya existe una cuenta con ese email');

  const user = await User.create({
    ...data,
    companyId: req.companyId,
    passwordHash: await User.hashPassword(password),
  });

  const created = await User.findByPk(user.id);
  res.status(201).json({ data: serialize(created) });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    where: { id: req.params.id, companyId: req.companyId },
  });
  if (!user) throw ApiError.notFound('El usuario no existe');
  res.json({ data: serialize(user) });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    where: { id: req.params.id, companyId: req.companyId },
  });
  if (!user) throw ApiError.notFound('El usuario no existe');

  const { password, ...changes } = req.body;

  // Un administrador no puede quitarse a si mismo el rol ni desactivarse: de
  // lo contrario una empresa podria quedar sin ningun admin.
  const isSelf = user.id === req.user.id;
  if (isSelf && changes.role && changes.role !== user.role) {
    throw ApiError.badRequest('No podes cambiar tu propio rol');
  }
  if (isSelf && changes.active === false) {
    throw ApiError.badRequest('No podes desactivar tu propia cuenta');
  }

  // Tampoco se puede dejar la empresa sin administradores activos.
  const losesAdmin =
    user.role === ROLES.ADMIN &&
    ((changes.role && changes.role !== ROLES.ADMIN) || changes.active === false);

  if (losesAdmin) {
    const activeAdmins = await User.count({
      where: { companyId: req.companyId, role: ROLES.ADMIN, active: true },
    });
    if (activeAdmins <= 1) {
      throw ApiError.badRequest('La empresa debe conservar al menos un administrador activo');
    }
  }

  if (changes.email && changes.email !== user.email) {
    const taken = await User.findOne({ where: { email: changes.email } });
    if (taken) throw ApiError.conflict('Ya existe una cuenta con ese email');
  }

  if (password) changes.passwordHash = await User.hashPassword(password);

  await user.update(changes);
  const updated = await User.findByPk(user.id);
  res.json({ data: serialize(updated) });
});

// Baja logica: los movimientos de stock guardan el autor, asi que la cuenta
// no se elimina.
export const deactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    where: { id: req.params.id, companyId: req.companyId },
  });
  if (!user) throw ApiError.notFound('El usuario no existe');
  if (user.id === req.user.id) {
    throw ApiError.badRequest('No podes desactivar tu propia cuenta');
  }

  if (user.role === ROLES.ADMIN) {
    const activeAdmins = await User.count({
      where: { companyId: req.companyId, role: ROLES.ADMIN, active: true },
    });
    if (activeAdmins <= 1) {
      throw ApiError.badRequest('La empresa debe conservar al menos un administrador activo');
    }
  }

  await user.update({ active: false });
  res.json({ data: serialize(user), message: 'Usuario desactivado' });
});
