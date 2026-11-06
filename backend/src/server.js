import app from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import prisma from './infra/prisma.js';

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, '🏥 HMS API server started');
});

// ── Graceful shutdown ───────────────────────────────────────
const shutdown = async (signal) => {
  logger.info({ signal }, 'Shutdown signal received');
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Server and database connections closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
