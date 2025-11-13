import type {PrismaClient} from '../generated/client.js';

/**
 * Reset database by deleting all data in correct order
 * Order matters due to foreign key constraints
 * @param prisma - Prisma client instance
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  console.log('🗑️  Resetting database...');
  // Order matters due to FKs
  await prisma.commentIndex.deleteMany();
  await prisma.reaction.deleteMany();
  await prisma.reactionSummary.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.book.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.user.deleteMany();
}
