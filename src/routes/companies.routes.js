import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createCompany,
  getCompany,
  listCompanies,
  updateCompany,
} from '../controllers/companyController.js';
import {
  createCompanySchema,
  listCompaniesSchema,
  updateCompanySchema,
} from '../validators/companyValidators.js';
import { idParam } from '../validators/common.js';

// Panel de plataforma: alta y administracion de empresas. Reservado al
// super_admin, que es el unico rol sin companyId propio.
export const companiesRouter = Router();

companiesRouter.use(authenticate, requireSuperAdmin);

companiesRouter.get('/', validate(listCompaniesSchema), listCompanies);
companiesRouter.post('/', validate(createCompanySchema), createCompany);
companiesRouter.get('/:id', validate({ params: idParam }), getCompany);
companiesRouter.patch('/:id', validate(updateCompanySchema), updateCompany);
