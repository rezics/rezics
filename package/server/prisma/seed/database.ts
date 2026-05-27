import type { PrismaClient } from "#/prisma/generated/client.js";

/**
 * Reset database by deleting all data in FK-safe order.
 * Groups at the same FK level are deleted in parallel.
 *
 * This wipes everything. Run the seed CLI afterward to recreate users and
 * infrastructure.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  console.log("[Reset] Resetting database...");

  // Group 1: Leaf tables with no dependents
  await Promise.all([
    prisma.apiToken.deleteMany(),
    prisma.feedback.deleteMany(),
    prisma.tagVote.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.subjectAttribution.deleteMany(),
    prisma.creditAttribution.deleteMany(),
    prisma.scoreRealmField.deleteMany(),
    prisma.scoreAggregate.deleteMany(),
  ]);

  // Group 2: Aggregate / junction leaves
  await Promise.all([prisma.realmTagApplication.deleteMany()]);

  // Group 3: Realm + shelf + tag junction
  await prisma.shelfUnitRelation.deleteMany();
  await Promise.all([
    prisma.unitRealm.deleteMany(),
    prisma.realmMember.deleteMany(),
    prisma.shelfUnit.deleteMany(),
    prisma.unitTag.deleteMany(),
  ]);

  // Group 4: Extension children
  // ContentStructureNode rows hold FKs to ContentStructure; delete them first
  // so the parent delete in this group doesn't trip a constraint.
  await prisma.contentStructureNode.deleteMany();
  await Promise.all([
    prisma.contentStructure.deleteMany(),
    prisma.gamePlatform.deleteMany(),
  ]);

  // Group 5: Type extensions (1:1 with Unit)
  // Post must be deleted before ScoreEntry (FK constraint)
  await prisma.post.deleteMany();
  await prisma.scoreEntry.deleteMany();
  await Promise.all([
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
  // Drop SlugScope rows first — they reference SCOPE Units; Unit.deleteMany
  // cascades only what Prisma models, but SlugScope.unitId has no FK.
  await prisma.slugScope.deleteMany();
  await prisma.unit.deleteMany();

  // Group 8: Identity + entity
  await Promise.all([prisma.user.deleteMany(), prisma.entity.deleteMany()]);

  // Group 9: Platform misc
  await Promise.all([prisma.echoKV.deleteMany(), prisma.jwks.deleteMany()]);
  await prisma.jwtService.deleteMany();

  console.log("[Reset] Database reset complete.");
}
