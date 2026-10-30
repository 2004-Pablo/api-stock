import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { Company, User } from '../models/index.js';
import { signAccessToken } from '../services/tokenService.js';
import { ROLE_LABELS } from '../constants/roles.js';

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    active: user.active,
    lastLoginAt: user.lastLoginAt,
    companyId: user.companyId,
    company: user.company
      ? {
          id: user.company.id,
          name: user.company.name,
          slug: user.company.slug,
          settings: user.company.settings,
        }
      : null,
  };
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.scope('withPassword').findOne({
    where: { email },
    include: [{ model: Company, as: 'company' }],
  });

  // Mismo mensaje para email inexistente y contrasena incorrecta, para no
  // revelar que cuentas existen.
  const invalid = ApiError.unauthorized('Email o contrasena incorrectos');
  if (!user) throw invalid;

  const passwordMatches = await user.verifyPassword(password);
  if (!passwordMatches) throw invalid;

  if (!user.active) throw ApiError.forbidden('La cuenta esta desactivada');
  if (user.company && !user.company.active) {
    throw ApiError.forbidden('La empresa esta desactivada');
  }

  user.lastLoginAt = new Date();
  await user.save();

  res.json({
    token: signAccessToken(user),
    user: publicUser(user),
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.scope('withPassword').findByPk(req.user.id);
  const matches = await user.verifyPassword(currentPassword);
  if (!matches) throw ApiError.badRequest('La contrasena actual no es correcta');

  if (currentPassword === newPassword) {
    throw ApiError.badRequest('La nueva contrasena debe ser distinta de la actual');
  }

  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();

  res.json({ message: 'Contrasena actualizada' });
});

export { publicUser };
