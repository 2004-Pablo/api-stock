import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { changePassword, login, me } from '../controllers/authController.js';
import { changePasswordSchema, loginSchema } from '../validators/authValidators.js';

// Freno simple a la fuerza bruta sobre el login.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Demasiados intentos de inicio de sesion, probá en unos minutos' } },
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate(loginSchema), login);
authRouter.get('/me', authenticate, me);
authRouter.post('/change-password', authenticate, validate(changePasswordSchema), changePassword);
