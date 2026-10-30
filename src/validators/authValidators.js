import { z } from 'zod';

export const loginSchema = {
  body: z.object({
    email: z.string().trim().toLowerCase().email('Email invalido'),
    password: z.string().min(1, 'La contrasena es obligatoria'),
  }),
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, 'Ingresa tu contrasena actual'),
    newPassword: z
      .string()
      .min(8, 'La nueva contrasena debe tener al menos 8 caracteres')
      .max(72, 'La contrasena es demasiado larga'),
  }),
};
