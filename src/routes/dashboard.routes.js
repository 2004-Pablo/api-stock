import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { resolveTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import {
  getLowStock,
  getMovementsTimeseries,
  getStockByCategory,
  getSummary,
  getTopProducts,
} from '../controllers/dashboardController.js';
import { dashboardQuerySchema } from '../validators/stockValidators.js';
import { ROLES } from '../constants/roles.js';

// El dashboard esta pensado para administradores y contables.
export const dashboardRouter = Router();

dashboardRouter.use(authenticate, resolveTenant, requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT));

dashboardRouter.get('/summary', getSummary);
dashboardRouter.get('/low-stock', validate(dashboardQuerySchema), getLowStock);
dashboardRouter.get('/movements', validate(dashboardQuerySchema), getMovementsTimeseries);
dashboardRouter.get('/top-products', validate(dashboardQuerySchema), getTopProducts);
dashboardRouter.get('/stock-by-category', getStockByCategory);
