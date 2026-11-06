import app from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import prisma from './infra/prisma.js';

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, '🏥 HMS API server started');
});

// ── Graceful shutdown handling ──────────────────────────────
const shutdown = async (signal) => {
  logger.info({ signal }, 'Shutdown signal received. Closing active HTTP connections...');

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error during HTTP server close');
      process.exit(1);
    }

    try {
      await prisma.$disconnect();
      logger.info('Database connections closed cleanly.');
      process.exit(0);
    } catch (dbErr) {
      logger.error({ dbErr }, 'Error disconnecting database');
      process.exit(1);
    }
  });

  // Force exit after 10 seconds if shutdown hangs
  setTimeout(() => {
    logger.error('Forced shutdown invoked after timeout threshold');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled Promise Rejection detected');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception detected — shutting down');
  shutdown('uncaughtException');
});
