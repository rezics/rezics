import type { PrismaClient } from "#/prisma/generated/client.js";

/**
 * Reset database by deleting all data in FK-safe order.
 * Groups at the same FK level are deleted in parallel.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  console.log("[Reset] Resetting database...");

  // Group 1: Leaf tables with no dependents
  await Promise.all([
    prisma.apiToken.deleteMany(),
    prisma.feedback.deleteMany(),
    prisma.tagVote.deleteMany(),
    prisma.shelfItemReview.deleteMany(),
    prisma.reaction.deleteMany(),
    prisma.follow.deleteMany(),
    prisma.personCredit.deleteMany(),
    prisma.orgCredit.deleteMany(),
  ]);

  // Group 2: Aggregate / junction leaves
  await Promise.all([
    prisma.reactionSummary.deleteMany(),
    prisma.rating.deleteMany(),
    prisma.realmTagUnit.deleteMany(),
  ]);

  // Group 3: Realm + shelf + tag junction
  await Promise.all([
    prisma.realmUnit.deleteMany(),
    prisma.realmMember.deleteMany(),
    prisma.shelfItem.deleteMany(),
    prisma.unitTag.deleteMany(),
  ]);

  // Group 4: Extension children
  await Promise.all([
    prisma.bookIndex.deleteMany(),
    prisma.gamePlatform.deleteMany(),
  ]);

  // Group 5: Type extensions (1:1 with Unit)
  await Promise.all([
    prisma.post.deleteMany(),
    prisma.shelf.deleteMany(),
    prisma.realm.deleteMany(),
    prisma.book.deleteMany(),
    prisma.game.deleteMany(),
    prisma.media.deleteMany(),
    prisma.link.deleteMany(),
  ]);

  // Group 6: Translation layer
  await Promise.all([
    prisma.unitTranslation.deleteMany(),
    prisma.unitSupportLanguage.deleteMany(),
  ]);

  // Group 7: Core
  await prisma.unit.deleteMany();

  // Group 8: Identity + attribution
  await Promise.all([
    prisma.user.deleteMany(),
    prisma.person.deleteMany(),
    prisma.organization.deleteMany(),
  ]);

  // Group 9: Platform misc
  await Promise.all([
    prisma.echoKV.deleteMany(),
    prisma.jwks.deleteMany(),
  ]);
  await prisma.jwtService.deleteMany();

  console.log("[Reset] Database reset complete.");
}
