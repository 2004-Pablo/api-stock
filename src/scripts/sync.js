import { sequelize } from '../config/database.js';
import '../models/index.js';

const force = process.argv.includes('--force');

try {
  await sequelize.sync({ force });
  console.log(force ? 'Esquema recreado desde cero.' : 'Esquema sincronizado.');
  await sequelize.close();
} catch (error) {
  console.error('No se pudo sincronizar el esquema:', error);
  process.exitCode = 1;
}
