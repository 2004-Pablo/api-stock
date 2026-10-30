import { Op, Transaction } from 'sequelize';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sequelize, Company, Product, StockMovement, User } from '../models/index.js';
import { buildPage, parsePagination } from '../utils/pagination.js';
import { DEFAULT_COMPANY_SETTINGS } from '../models/Company.js';
import { ROLES } from '../constants/roles.js';

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function uniqueSlug(base) {
  const root = slugify(base) || 'empresa';
  let candidate = root;
  let suffix = 2;
  // Se busca el primer sufijo libre; en V1 el volumen de empresas es bajo.
  while (await Company.findOne({ where: { slug: candidate } })) {
    candidate = `${root}-${suffix}`.slice(0, 60);
    suffix += 1;
  }
  return candidate;
}

export const listCompanies = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const where = {};

  if (req.query.active !== undefined) where.active = req.query.active;
  if (req.query.search) {
    const pattern = `%${req.query.search}%`;
    where[Op.or] = [
      { name: { [Op.like]: pattern } },
      { slug: { [Op.like]: pattern } },
      { taxId: { [Op.like]: pattern } },
    ];
  }

  const { rows, count } = await Company.findAndCountAll({
    where,
    order: [['name', 'ASC']],
    limit,
    offset,
  });

  // Unas pocas metricas por empresa para el panel de plataforma.
  const data = await Promise.all(
    rows.map(async (company) => {
      const [userCount, productCount] = await Promise.all([
        User.count({ where: { companyId: company.id, active: true } }),
        Product.count({ where: { companyId: company.id, active: true } }),
      ]);
      return { ...company.toJSON(), userCount, productCount };
    }),
  );

  res.json(buildPage({ rows: data, count, page, limit }));
});

// Crea la empresa y, si se envia, su primer administrador. Todo junto en una
// transaccion: una empresa sin admin no serviria para nada.
export const createCompany = asyncHandler(async (req, res) => {
  const { admin, slug, settings, ...data } = req.body;

  if (admin) {
    const taken = await User.findOne({ where: { email: admin.email } });
    if (taken) throw ApiError.conflict('Ya existe una cuenta con el email del administrador');
  }

  const result = await sequelize.transaction(
    { type: Transaction.TYPES.IMMEDIATE },
    async (transaction) => {
      const company = await Company.create(
        {
          ...data,
          slug: slug ? slugify(slug) : await uniqueSlug(data.name),
          settings: { ...DEFAULT_COMPANY_SETTINGS, ...(settings ?? {}) },
        },
        { transaction },
      );

      let createdAdmin = null;
      if (admin) {
        createdAdmin = await User.create(
          {
            companyId: company.id,
            name: admin.name,
            email: admin.email,
            role: ROLES.ADMIN,
            passwordHash: await User.hashPassword(admin.password),
          },
          { transaction },
        );
      }

      return { company, createdAdmin };
    },
  );

  res.status(201).json({
    data: {
      ...result.company.toJSON(),
      admin: result.createdAdmin
        ? {
            id: result.createdAdmin.id,
            name: result.createdAdmin.name,
            email: result.createdAdmin.email,
            role: result.createdAdmin.role,
          }
        : null,
    },
  });
});

export const getCompany = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) throw ApiError.notFound('La empresa no existe');

  const [userCount, productCount, movementCount] = await Promise.all([
    User.count({ where: { companyId: company.id } }),
    Product.count({ where: { companyId: company.id } }),
    StockMovement.count({ where: { companyId: company.id } }),
  ]);

  res.json({ data: { ...company.toJSON(), userCount, productCount, movementCount } });
});

export const updateCompany = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) throw ApiError.notFound('La empresa no existe');

  await applyCompanyChanges(company, req.body);
  res.json({ data: company });
});

// --- Seccion de configuracion de la propia empresa -----------------------

export const getOwnCompany = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.companyId);
  if (!company) throw ApiError.notFound('La empresa no existe');

  const [userCount, productCount] = await Promise.all([
    User.count({ where: { companyId: company.id, active: true } }),
    Product.count({ where: { companyId: company.id, active: true } }),
  ]);

  res.json({ data: { ...company.toJSON(), userCount, productCount } });
});

export const updateOwnCompany = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.companyId);
  if (!company) throw ApiError.notFound('La empresa no existe');

  await applyCompanyChanges(company, req.body);
  res.json({ data: company });
});

// settings se mezcla con lo existente para poder guardar una sola clave sin
// borrar el resto de la configuracion.
async function applyCompanyChanges(company, body) {
  const { settings, ...changes } = body;
  if (settings) {
    changes.settings = { ...company.settings, ...settings };
  }
  await company.update(changes);
  return company;
}
