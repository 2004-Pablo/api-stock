import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..', '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env') });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required('JWT_SECRET', nodeEnv === 'production' ? undefined : 'dev-secret-no-usar-en-produccion'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  dbStorage: path.resolve(ROOT_DIR, process.env.DB_STORAGE ?? 'data/inventario.sqlite'),
  dbSync: (process.env.DB_SYNC ?? 'true') === 'true',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
