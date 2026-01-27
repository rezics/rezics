// cleanup-verification.ts
import 'dotenv/config';
import {prisma} from '../../prisma/client';

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
  .then(async () => {
    console.log('[Cleanup] Done');
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async err => {
    console.error('[Cleanup] Error:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
