import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const prisma = new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
  log:
    env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
        ]
      : [{ emit: 'event', level: 'error' }],
});

if (env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug({ duration: e.duration, query: e.query }, 'prisma query');
  });
}

prisma.$on('error', (e) => {
  logger.error({ message: e.message }, 'prisma error');
});

export default prisma;
