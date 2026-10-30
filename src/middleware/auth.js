import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../services/tokenService.js';
import { Company, User } from '../models/index.js';

function extractToken(req) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

// Verifica el JWT y deja en req.user el usuario vigente de la base.
// Se relee en cada pedido para que una baja o un cambio de rol tenga efecto
// inmediato, sin esperar a que expire el token.
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Falta el token de acceso');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    const message = error.name === 'TokenExpiredError'
      ? 'La sesion expiro, volve a iniciar sesion'
      : 'Token de acceso invalido';
    throw ApiError.unauthorized(message);
  }

  const user = await User.findByPk(payload.sub, {
    include: [{ model: Company, as: 'company' }],
  });

  if (!user || !user.active) {
    throw ApiError.unauthorized('La cuenta no esta disponible');
  }
  if (user.company && !user.company.active) {
    throw ApiError.forbidden('La empresa esta desactivada');
  }

  req.user = user;
  next();
});
