import type { PrismaClient } from "../generated/client.js";

/**
 * Reset database by deleting all data in FK-safe order.
 * Groups at the same FK level are deleted in parallel.
 *
 * This wipes everything. Run the seed CLI afterward to recreate users and
 * infrastructure.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  console.log("[Reset] Resetting database...");

  // Group 1: Leaf tables with no dependents or only id-shaped references.
  await Promise.all([
    prisma.staffAuditLog.deleteMany(),
    prisma.userBlock.deleteMany(),
    prisma.emailVerificationContract.deleteMany(),
    prisma.apiToken.deleteMany(),
    prisma.tagVote.deleteMany(),
    prisma.unitAliasVote.deleteMany(),
    prisma.pollVote.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.userContentNodeProgress.deleteMany(),
    prisma.userUnitProgress.deleteMany(),
    prisma.userUnitCollection.deleteMany(),
    prisma.userTagApplication.deleteMany(),
    prisma.realmTagApplicationVote.deleteMany(),
    prisma.realmRuleAcknowledgement.deleteMany(),
    prisma.staffGrant.deleteMany(),
    prisma.realmCapabilityGrant.deleteMany(),
    prisma.unitCollaborator.deleteMany(),
    prisma.unitFieldLock.deleteMany(),
    prisma.historyOutbox.deleteMany(),
    prisma.unitHistoryClock.deleteMany(),
  ]);

  // Group 2: Moderation and feedback records.
  await prisma.accountEnforcement.deleteMany();
  await prisma.moderationAction.deleteMany();
  await prisma.moderationCase.deleteMany();
  await prisma.feedback.deleteMany();

  // Group 3: Attribution and external-reference leaves.
  await Promise.all([
    prisma.creditAttributionEvidence.deleteMany(),
    prisma.gameSystemRequirement.deleteMany(),
  ]);
  await Promise.all([
    prisma.unitExternalRef.deleteMany(),
    prisma.subjectAttribution.deleteMany(),
    prisma.creditAttribution.deleteMany(),
  ]);

  // Group 4: Poll, score, and tag leaves.
  await Promise.all([
    prisma.scoreRealmField.deleteMany(),
    prisma.scoreAggregate.deleteMany(),
    prisma.postPollReference.deleteMany(),
  ]);
  await prisma.pollOption.deleteMany();

  // Group 5: Aggregate / junction leaves.
  await Promise.all([prisma.realmTagApplication.deleteMany()]);
  await prisma.realmTagContext.deleteMany();

  // Group 6: Realm + shelf + tag junctions.
  await prisma.shelfUnitRelation.deleteMany();
  await Promise.all([
    prisma.unitRealm.deleteMany(),
    prisma.realmMember.deleteMany(),
    prisma.shelfUnit.deleteMany(),
    prisma.unitTag.deleteMany(),
  ]);

  // Group 7: Extension children.
  // ContentStructureNode rows hold FKs to ContentStructure; delete them first
  // so the parent delete in this group doesn't trip a constraint.
  await prisma.seriesContentIndex.deleteMany();
  await prisma.contentStructureAnchor.deleteMany();
  await prisma.contentStructureNode.deleteMany();
  await Promise.all([
    prisma.contentStructure.deleteMany(),
    prisma.sourceSite.deleteMany(),
  ]);

  // Group 8: Type extensions (1:1 with Unit).
  // Post must be deleted before ScoreEntry (FK constraint)
  await prisma.commentPromotion.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.scoreEntry.deleteMany();
  await Promise.all([
    prisma.poll.deleteMany(),
    prisma.shelf.deleteMany(),
    prisma.series.deleteMany(),
    prisma.realm.deleteMany(),
    prisma.book.deleteMany(),
    prisma.game.deleteMany(),
    prisma.media.deleteMany(),
    prisma.link.deleteMany(),
    prisma.zone.deleteMany(),
    prisma.entity.deleteMany(),
  ]);

  // Group 9: Translation layer.
  await Promise.all([
    prisma.contentTranslation.deleteMany(),
    prisma.unitAlias.deleteMany(),
    prisma.unitTranslation.deleteMany(),
    prisma.unitSupportLanguage.deleteMany(),
  ]);

  // Group 10: Core.
  // Drop SlugScope rows first — they reference SCOPE Units; Unit.deleteMany
  // cascades only what Prisma models, but SlugScope.unitId has no FK.
  await prisma.slugScope.deleteMany();
  await prisma.unit.deleteMany();

  // Group 11: Identity.
  await prisma.user.deleteMany();

  // Group 12: Platform misc.
  await Promise.all([prisma.echoKV.deleteMany(), prisma.jwks.deleteMany()]);
  await prisma.jwtService.deleteMany();

  console.log("[Reset] Database reset complete.");
}
