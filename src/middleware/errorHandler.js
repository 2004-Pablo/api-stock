import { ValidationError, UniqueConstraintError, ForeignKeyConstraintError } from 'sequelize';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`No existe la ruta ${req.method} ${req.originalUrl}`));
}

// Traduce los errores conocidos a una respuesta JSON uniforme:
// { error: { message, details? } }
export function errorHandler(error, _req, res, _next) {
  let status = error.status ?? 500;
  let message = error.message ?? 'Error interno del servidor';
  let details = error.details;

  if (error instanceof UniqueConstraintError) {
    status = 409;
    message = 'Ya existe un registro con esos datos';
    details = error.errors.map((item) => ({ field: item.path, message: 'Ya esta en uso' }));
  } else if (error instanceof ForeignKeyConstraintError) {
    status = 400;
    message = 'La referencia indicada no existe';
  } else if (error instanceof ValidationError) {
    status = 400;
    message = 'Los datos enviados no son validos';
    details = error.errors.map((item) => ({ field: item.path, message: item.message }));
  } else if (!(error instanceof ApiError) && status === 500) {
    console.error('[error]', error);
    if (env.isProduction) message = 'Error interno del servidor';
  }

  const body = { error: { message } };
  if (details) body.error.details = details;
  if (!env.isProduction && status === 500 && error.stack) body.error.stack = error.stack;

  res.status(status).json(body);
}
