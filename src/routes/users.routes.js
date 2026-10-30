import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { resolveTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import {
  createUser,
  deactivateUser,
  getUser,
  listUsers,
  updateUser,
} from '../controllers/userController.js';
import {
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
} from '../validators/userValidators.js';
import { idParam } from '../validators/common.js';
import { ROLES } from '../constants/roles.js';

// Gestion de usuarios de una empresa: solo el administrador de esa instancia.
export const usersRouter = Router();

usersRouter.use(authenticate, resolveTenant, requireRole(ROLES.ADMIN));

usersRouter.get('/', validate(listUsersSchema), listUsers);
usersRouter.post('/', validate(createUserSchema), createUser);
usersRouter.get('/:id', validate({ params: idParam }), getUser);
usersRouter.patch('/:id', validate(updateUserSchema), updateUser);
usersRouter.delete('/:id', validate({ params: idParam }), deactivateUser);
