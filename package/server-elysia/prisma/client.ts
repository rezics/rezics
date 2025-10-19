import {PrismaClient} from './generated/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {Pool} from 'pg';

// Get database URL from environment variable
const databaseUrl = process.env.PRISMA_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('PRISMA_DATABASE_URL environment variable is not set');
}

// Create a PostgreSQL connection pool optimized for Elysia/Bun
const pool = new Pool({
  connectionString: databaseUrl,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Connection timeout
});

// Enable query logging in development
const enableQueryEventLogging =
  (process.env.NODE_ENV ?? 'development') !== 'production' &&
  (process.env.PRISMA_LOG_QUERIES ?? '1') !== '0' &&
  (process.env.PRISMA_LOG_QUERIES ?? '1') !== 'false';

// Initialize Prisma Client with PostgreSQL adapter
export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: enableQueryEventLogging
    ? [{emit: 'event', level: 'query'} as const]
    : [],
});

// Log queries in development
if (enableQueryEventLogging) {
  prisma.$on('query', e => {
    console.log(`[Prisma Query] ${e.duration}ms: ${e.query}`);
  });
}

// Handle graceful shutdown for Elysia
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});

export * from './generated/client';
