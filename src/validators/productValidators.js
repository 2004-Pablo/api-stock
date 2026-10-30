import { z } from 'zod';
import { PRODUCT_UNITS } from '../constants/roles.js';
import { amount, booleanish, money, optionalText, paginationQuery, uuid } from './common.js';

export const listProductsSchema = {
  query: z.object({
    ...paginationQuery,
    search: optionalText(160),
    categoryId: uuid.optional(),
    active: booleanish.optional(),
    // Solo productos cuyo stock esta en o por debajo del minimo.
    lowStock: booleanish.optional(),
    sortBy: z.enum(['name', 'sku', 'quantity', 'createdAt', 'updatedAt']).default('name'),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
  }),
};

export const createProductSchema = {
  body: z.object({
    sku: z.string().trim().min(1, 'El SKU es obligatorio').max(40),
    name: z.string().trim().min(2, 'El nombre es obligatorio').max(160),
    description: optionalText(2000),
    barcode: optionalText(60),
    categoryId: uuid.optional().nullable(),
    unit: z.enum(PRODUCT_UNITS).default('unidad'),
    costPrice: money.default(0),
    salePrice: money.default(0),
    minStock: amount.optional().nullable(),
    location: optionalText(80),
    // Stock con el que nace el producto: genera un movimiento inicial.
    initialQuantity: amount.default(0),
  }),
};

export const updateProductSchema = {
  params: z.object({ id: uuid }),
  body: z
    .object({
      sku: z.string().trim().min(1).max(40).optional(),
      name: z.string().trim().min(2).max(160).optional(),
      description: optionalText(2000),
      barcode: optionalText(60),
      categoryId: uuid.optional().nullable(),
      unit: z.enum(PRODUCT_UNITS).optional(),
      costPrice: money.optional(),
      salePrice: money.optional(),
      minStock: amount.optional().nullable(),
      location: optionalText(80),
      active: booleanish.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'No hay cambios para aplicar' }),
};
