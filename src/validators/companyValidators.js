import { z } from 'zod';
import { booleanish, optionalText, paginationQuery, uuid } from './common.js';

const settingsSchema = z
  .object({
    currency: z.string().trim().min(1).max(8).optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    defaultMinStock: z.coerce.number().min(0).max(1_000_000).optional(),
    allowNegativeStock: booleanish.optional(),
  })
  .strict();

export const listCompaniesSchema = {
  query: z.object({
    ...paginationQuery,
    search: optionalText(120),
    active: booleanish.optional(),
  }),
};

export const createCompanySchema = {
  body: z.object({
    name: z.string().trim().min(2, 'El nombre es obligatorio').max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]+$/, 'Solo letras minusculas, numeros y guiones')
      .min(2)
      .max(60)
      .optional(),
    taxId: optionalText(20),
    email: z.string().trim().toLowerCase().email('Email invalido').optional().nullable(),
    phone: optionalText(40),
    address: optionalText(240),
    settings: settingsSchema.optional(),
    // Permite crear la empresa junto con su primer administrador.
    admin: z
      .object({
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().toLowerCase().email('Email invalido'),
        password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres').max(72),
      })
      .optional(),
  }),
};

export const updateCompanySchema = {
  params: z.object({ id: uuid }),
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      taxId: optionalText(20),
      email: z.string().trim().toLowerCase().email('Email invalido').optional().nullable(),
      phone: optionalText(40),
      address: optionalText(240),
      settings: settingsSchema.optional(),
      active: booleanish.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'No hay cambios para aplicar' }),
};

// La seccion de configuracion solo toca los datos de la propia empresa.
export const updateOwnCompanySchema = {
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      taxId: optionalText(20),
      email: z.string().trim().toLowerCase().email('Email invalido').optional().nullable(),
      phone: optionalText(40),
      address: optionalText(240),
      settings: settingsSchema.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'No hay cambios para aplicar' }),
};
