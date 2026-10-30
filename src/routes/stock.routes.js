import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { resolveTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import {
  createMovement,
  createMovementBatch,
  getMovement,
  listMovements,
} from '../controllers/stockController.js';
import {
  bulkMovementSchema,
  createMovementSchema,
  listMovementsSchema,
} from '../validators/stockValidators.js';
import { idParam } from '../validators/common.js';
import { ROLES } from '../constants/roles.js';

export const stockRouter = Router();

stockRouter.use(authenticate, resolveTenant);

// El contable consulta el historial pero no mueve stock.
const canRead = requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.OPERATOR);
const canMove = requireRole(ROLES.ADMIN, ROLES.OPERATOR);

stockRouter.get('/movements', canRead, validate(listMovementsSchema), listMovements);
stockRouter.get('/movements/:id', canRead, validate({ params: idParam }), getMovement);
stockRouter.post('/movements', canMove, validate(createMovementSchema), createMovement);
stockRouter.post('/movements/batch', canMove, validate(bulkMovementSchema), createMovementBatch);
