// cleanup-verification.ts
import 'dotenv/config';
import {PrismaClient} from '@/prisma/generated/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  const deleted = await prisma.verificationCode.deleteMany({
    where: {
      expiresAt: {lt: now},
      usedAt: null,
    },
  });

  console.log(`[Cleanup] Deleted ${deleted.count} expired verification codes`);
}

main()
  .then(() => {
    console.log('[Cleanup] Done');
    process.exit(0);
  })
  .catch(err => {
    console.error('[Cleanup] Error:', err);
    process.exit(1);
  });
