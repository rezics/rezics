import {PrismaClient} from './prisma/generated/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {Database} from './database';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: Database.connectionString,
  }),
});

export * from './prisma/generated/client';
