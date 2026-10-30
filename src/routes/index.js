import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { companiesRouter } from './companies.routes.js';
import { usersRouter } from './users.routes.js';
import { categoriesRouter } from './categories.routes.js';
import { productsRouter } from './products.routes.js';
import { stockRouter } from './stock.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { settingsRouter } from './settings.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/companies', companiesRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/stock', stockRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/settings', settingsRouter);
