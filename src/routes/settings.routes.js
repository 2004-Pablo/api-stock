import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { resolveTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { getOwnCompany, updateOwnCompany } from '../controllers/companyController.js';
import { updateOwnCompanySchema } from '../validators/companyValidators.js';
import { ROLES, ROLE_LABELS, PRODUCT_UNITS, MOVEMENT_TYPE_VALUES } from '../constants/roles.js';

// Seccion de configuracion: datos y preferencias de la propia empresa.
export const settingsRouter = Router();

settingsRouter.use(authenticate, resolveTenant);

settingsRouter.get(
  '/company',
  requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT),
  getOwnCompany,
);
settingsRouter.patch(
  '/company',
  requireRole(ROLES.ADMIN),
  validate(updateOwnCompanySchema),
  updateOwnCompany,
);

// Catalogos fijos que el frontend necesita para armar los selects.
settingsRouter.get('/options', (_req, res) => {
  res.json({
    data: {
      roles: Object.entries(ROLE_LABELS)
        .filter(([role]) => role !== ROLES.SUPER_ADMIN)
        .map(([value, label]) => ({ value, label })),
      units: PRODUCT_UNITS,
      movementTypes: MOVEMENT_TYPE_VALUES,
    },
  });
});
