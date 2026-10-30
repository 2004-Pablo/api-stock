import { z } from 'zod';
import { booleanish, optionalText, paginationQuery, uuid } from './common.js';

export const listCategoriesSchema = {
  query: z.object({
    ...paginationQuery,
    search: optionalText(80),
    active: booleanish.optional(),
  }),
};

export const createCategorySchema = {
  body: z.object({
    name: z.string().trim().min(2, 'El nombre es obligatorio').max(80),
    description: optionalText(240),
  }),
};

export const updateCategorySchema = {
  params: z.object({ id: uuid }),
  body: z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      description: optionalText(240),
      active: booleanish.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'No hay cambios para aplicar' }),
};
