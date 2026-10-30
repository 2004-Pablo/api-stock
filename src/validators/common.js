import { z } from 'zod';

export const uuid = z.string().uuid('Debe ser un identificador valido');

export const idParam = z.object({ id: uuid });

export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
};

// Acepta "true"/"false" desde la query string ademas de booleanos reales.
export const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');

export const money = z.coerce.number().min(0, 'No puede ser negativo').max(99_999_999);
export const amount = z.coerce.number().min(0, 'No puede ser negativo').max(99_999_999);
export const positiveAmount = z.coerce
  .number()
  .positive('Debe ser mayor a cero')
  .max(99_999_999);

export const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value === '' ? null : value));
