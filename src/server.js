import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, sequelize } from './config/database.js';
import './models/index.js';

async function start() {
  try {
    await connectDatabase();
    console.log(`Base de datos conectada (${env.dbStorage})`);

    // En desarrollo alcanza con sync; para produccion conviene pasar a
    // migraciones de sequelize-cli.
    if (env.dbSync) {
      await sequelize.sync();
      console.log('Esquema sincronizado');
    }

    const app = createApp();
    const server = app.listen(env.port, () => {
      console.log(`API escuchando en http://localhost:${env.port}/api`);
    });

    const shutdown = async (signal) => {
      console.log(`\n${signal} recibido, cerrando...`);
      server.close(async () => {
        await sequelize.close();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error);
    process.exit(1);
  }
}

start();
