import { z } from 'zod';
import { MOVEMENT_TYPES, MOVEMENT_TYPE_VALUES } from '../constants/roles.js';
import { amount, money, optionalText, paginationQuery, positiveAmount, uuid } from './common.js';

export const listMovementsSchema = {
  query: z.object({
    ...paginationQuery,
    productId: uuid.optional(),
    userId: uuid.optional(),
    type: z.enum(MOVEMENT_TYPE_VALUES).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    // Atajo para "los ultimos N dias". Se resuelve con la zona horaria de la
    // empresa, asi que no depende del reloj de quien consulta. Si ademas viene
    // `from`, gana `from`.
    days: z.coerce.number().int().min(1).max(3650).optional(),
    search: optionalText(120),
  }),
};

export const createMovementSchema = {
  body: z
    .object({
      productId: uuid,
      type: z.enum(MOVEMENT_TYPE_VALUES),
      // En entradas y salidas es la cantidad a mover; en un ajuste es el
      // conteo final que quedo en el deposito (puede ser cero).
      quantity: amount,
      unitCost: money.optional().nullable(),
      reason: optionalText(120),
      reference: optionalText(80),
      notes: optionalText(2000),
    })
    .superRefine((data, ctx) => {
      if (data.type !== MOVEMENT_TYPES.ADJUSTMENT && data.quantity <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['quantity'],
          message: 'En entradas y salidas la cantidad debe ser mayor a cero',
        });
      }
    }),
};

export const bulkMovementSchema = {
  body: z.object({
    reference: optionalText(80),
    reason: optionalText(120),
    items: z
      .array(
        z.object({
          productId: uuid,
          type: z.enum([MOVEMENT_TYPES.IN, MOVEMENT_TYPES.OUT]),
          quantity: positiveAmount,
          unitCost: money.optional().nullable(),
        }),
      )
      .min(1, 'Carga al menos un movimiento')
      .max(200, 'Maximo 200 movimientos por lote'),
  }),
};

export const dashboardQuerySchema = {
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
};
