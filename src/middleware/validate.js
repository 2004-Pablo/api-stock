import { ApiError } from '../utils/ApiError.js';

// Valida body, query y params con esquemas zod y reemplaza el valor original
// por el ya parseado (con tipos convertidos y defaults aplicados).
export function validate(schemas) {
  return (req, _res, next) => {
    try {
      for (const part of ['body', 'query', 'params']) {
        const schema = schemas[part];
        if (!schema) continue;
        const result = schema.safeParse(req[part]);
        if (!result.success) {
          const details = result.error.issues.map((issue) => ({
            field: issue.path.join('.') || part,
            message: issue.message,
          }));
          return next(ApiError.badRequest('Los datos enviados no son validos', details));
        }
        if (part === 'query') {
          // req.query puede ser de solo lectura segun la version de Express.
          Object.defineProperty(req, 'query', { value: result.data, writable: true });
        } else {
          req[part] = result.data;
        }
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
