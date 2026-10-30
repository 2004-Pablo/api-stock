import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Company } from '../models/index.js';
import { ROLES } from '../constants/roles.js';

// Resuelve la empresa sobre la que opera el pedido y la deja en
// req.companyId. Es el unico lugar donde se decide ese valor: los
// controladores nunca leen companyId del body ni de la query, asi que un
// usuario no puede pedir datos de otra empresa.
//
// Para super_admin, que no pertenece a ninguna empresa, la empresa se elige
// con el header X-Company-Id o el query param companyId.
export const resolveTenant = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw ApiError.unauthorized();

  if (req.user.role === ROLES.SUPER_ADMIN) {
    const requested = req.headers['x-company-id'] ?? req.query.companyId;
    if (!requested) {
      throw ApiError.badRequest(
        'Indica sobre que empresa operar con el header X-Company-Id o el parametro companyId',
      );
    }
    const company = await Company.findByPk(String(requested));
    if (!company) throw ApiError.notFound('La empresa indicada no existe');
    req.companyId = company.id;
    req.company = company;
    return next();
  }

  if (!req.user.companyId) {
    throw ApiError.forbidden('El usuario no tiene una empresa asignada');
  }

  req.companyId = req.user.companyId;
  req.company = req.user.company ?? null;
  return next();
});
