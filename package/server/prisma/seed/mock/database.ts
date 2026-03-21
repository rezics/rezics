import {meili} from '@package/search';
import type {PrismaClient} from '@/prisma/generated/client.js';

/**
 * Reset database by deleting all data in correct order
 * Order matters due to foreign key constraints
 * @param prisma - Prisma client instance
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  console.log('Resetting database...');
  // Order matters due to FKs
  await prisma.apiToken.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.commentIndex.deleteMany();
  await prisma.reaction.deleteMany();
  await prisma.reactionSummary.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.book.deleteMany();
  await prisma.seriesBook.deleteMany();
  await prisma.unitLocalizations.deleteMany();
  await prisma.bookIndex.deleteMany();
  await prisma.readList.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.user.deleteMany();
  await prisma.echoKV.deleteMany();
  await prisma.feedback.deleteMany();
}

export async function resetMeiliSearchDatabase(): Promise<void> {
  console.log('Resetting MeiliSearch database...');
  await meili.index('books').deleteAllDocuments();
  await meili.index('units').deleteAllDocuments();
  await meili.index('readlists').deleteAllDocuments();
  await meili.index('feedbacks').deleteAllDocuments();
  await meili.index('users').deleteAllDocuments();
}
