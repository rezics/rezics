import {PrismaClient} from './prisma/generated/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {Database} from './database';

const enableQueryEventLogging =
  (process.env.NODE_ENV ?? 'development') !== 'production' &&
  (process.env.PRISMA_LOG_QUERIES ?? '1') !== '0' &&
  (process.env.PRISMA_LOG_QUERIES ?? '1') !== 'false';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: Database.connectionString,
  }),
  log: [{emit: 'event', level: 'query'} as const],
});

if (enableQueryEventLogging) {
  prisma.$on('query', e => {
    // Log SQL and timing; avoid printing params in production
    console.log(`[${e.duration}ms] ${e.query}`);
  });
}

export * from './prisma/generated/client';
