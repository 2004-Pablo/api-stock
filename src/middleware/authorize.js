import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../constants/roles.js';

// Restringe una ruta a los roles indicados. super_admin siempre pasa.
export function requireRole(...allowedRoles) {
  const allowed = new Set([...allowedRoles, ROLES.SUPER_ADMIN]);
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowed.has(req.user.role)) {
      return next(ApiError.forbidden('Tu rol no permite esta accion'));
    }
    return next();
  };
}

export const requireSuperAdmin = (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    return next(ApiError.forbidden('Accion reservada al administrador de plataforma'));
  }
  return next();
};
