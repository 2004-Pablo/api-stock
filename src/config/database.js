import fs from 'node:fs';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import { env } from './env.js';

// SQLite necesita que exista la carpeta contenedora antes de crear el archivo.
fs.mkdirSync(path.dirname(env.dbStorage), { recursive: true });

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: env.dbStorage,
  logging: env.nodeEnv === 'development' ? (msg) => console.log(`[sql] ${msg}`) : false,
  define: {
    underscored: false,
    freezeTableName: false,
  },
});

export async function connectDatabase() {
  await sequelize.authenticate();
  // Las claves foraneas no vienen activadas por defecto en SQLite.
  await sequelize.query('PRAGMA foreign_keys = ON');
}
