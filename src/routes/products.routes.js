import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { resolveTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProductMovements,
  listProducts,
  updateProduct,
} from '../controllers/productController.js';
import {
  createProductSchema,
  listProductsSchema,
  updateProductSchema,
} from '../validators/productValidators.js';
import { idParam } from '../validators/common.js';
import { ROLES } from '../constants/roles.js';

export const productsRouter = Router();

productsRouter.use(authenticate, resolveTenant);

// El operador ve el stock y lo mueve, pero no da de alta ni edita productos.
const canRead = requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.OPERATOR);
const canWrite = requireRole(ROLES.ADMIN);

productsRouter.get('/', canRead, validate(listProductsSchema), listProducts);
productsRouter.get('/:id', canRead, validate({ params: idParam }), getProduct);
productsRouter.get(
  '/:id/movements',
  canRead,
  validate({ params: idParam }),
  listProductMovements,
);
productsRouter.post('/', canWrite, validate(createProductSchema), createProduct);
productsRouter.patch('/:id', canWrite, validate(updateProductSchema), updateProduct);
productsRouter.delete('/:id', canWrite, validate({ params: idParam }), deleteProduct);
