import { z } from 'zod';
import { ROLES } from '../constants/roles.js';
import { booleanish, optionalText, paginationQuery, uuid } from './common.js';

// super_admin se crea solo por seed o por otro super_admin desde /companies,
// no se ofrece como rol asignable dentro de una empresa.
const assignableRoles = [ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.OPERATOR];

export const listUsersSchema = {
  query: z.object({
    ...paginationQuery,
    search: optionalText(120),
    role: z.enum(assignableRoles).optional(),
    active: booleanish.optional(),
    companyId: uuid.optional(),
  }),
};

export const createUserSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'El nombre es obligatorio').max(120),
    email: z.string().trim().toLowerCase().email('Email invalido'),
    password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres').max(72),
    role: z.enum(assignableRoles),
    active: booleanish.optional(),
  }),
};

export const updateUserSchema = {
  params: z.object({ id: uuid }),
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      email: z.string().trim().toLowerCase().email('Email invalido').optional(),
      password: z.string().min(8).max(72).optional(),
      role: z.enum(assignableRoles).optional(),
      active: booleanish.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'No hay cambios para aplicar',
    }),
};
