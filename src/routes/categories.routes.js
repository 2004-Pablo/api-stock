import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { resolveTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from '../controllers/categoryController.js';
import {
  createCategorySchema,
  listCategoriesSchema,
  updateCategorySchema,
} from '../validators/categoryValidators.js';
import { idParam } from '../validators/common.js';
import { ROLES } from '../constants/roles.js';

export const categoriesRouter = Router();

categoriesRouter.use(authenticate, resolveTenant);

// Leer el catalogo lo necesitan todos los roles; escribirlo, solo el admin.
const canRead = requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.OPERATOR);
const canWrite = requireRole(ROLES.ADMIN);

categoriesRouter.get('/', canRead, validate(listCategoriesSchema), listCategories);
categoriesRouter.get('/:id', canRead, validate({ params: idParam }), getCategory);
categoriesRouter.post('/', canWrite, validate(createCategorySchema), createCategory);
categoriesRouter.patch('/:id', canWrite, validate(updateCategorySchema), updateCategory);
categoriesRouter.delete('/:id', canWrite, validate({ params: idParam }), deleteCategory);
