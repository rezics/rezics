import {PrismaClient} from '../../generated/client';
import {resetMeiliSearchDatabase} from '../database';

const prisma = new PrismaClient();

import {resetDatabase} from '../database';

async function main() {
  await resetDatabase(prisma);
  await resetMeiliSearchDatabase();
}

main()
  .catch(err => {
    console.error('Failed to reset database:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
