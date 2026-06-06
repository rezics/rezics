import type { ServerDb } from "../client";
import {
  AccountEnforcement,
  ApiToken,
  Book,
  Comment,
  CommentPromotion,
  ContentStructure,
  ContentStructureAnchor,
  ContentStructureNode,
  ContentTranslation,
  CreditAttribution,
  CreditAttributionEvidence,
  EchoKV,
  EmailVerificationContract,
  Entity,
  Feedback,
  Game,
  GameSystemRequirement,
  HistoryOutbox,
  Jwks,
  JwtService,
  Link,
  Media,
  ModerationAction,
  ModerationCase,
  Poll,
  PollOption,
  PollVote,
  Post,
  PostPollReference,
  PostUnitReference,
  Realm,
  RealmCapabilityGrant,
  RealmMember,
  RealmRuleAcknowledgement,
  RealmTagApplication,
  RealmTagApplicationVote,
  RealmTagContext,
  ScoreAggregate,
  ScoreEntry,
  ScoreRealmField,
  Series,
  SeriesContentIndex,
  Shelf,
  ShelfItem,
  SlugScope,
  SourceSite,
  StaffAuditLog,
  StaffGrant,
  SubjectAttribution,
  Subscription,
  TagVote,
  Unit,
  UnitAlias,
  UnitAliasVote,
  UnitCollaborator,
  UnitExternalRef,
  UnitFieldLock,
  UnitHistoryClock,
  UnitRealm,
  UnitSupportLanguage,
  UnitTag,
  UnitTranslation,
  User,
  UserBlock,
  UserContentNodeProgress,
  UserTagApplication,
  UserUnitProgress,
  Zone,
} from "../schema";

type ResetDatabaseDb = Pick<ServerDb, "delete">;
type ResetTable = readonly [
  name: string,
  table: Parameters<ServerDb["delete"]>[0],
];

export const RESET_DATABASE_TABLES = [
  ["StaffAuditLog", StaffAuditLog],
  ["UserBlock", UserBlock],
  ["EmailVerificationContract", EmailVerificationContract],
  ["ApiToken", ApiToken],
  ["TagVote", TagVote],
  ["UnitAliasVote", UnitAliasVote],
  ["PollVote", PollVote],
  ["Subscription", Subscription],
  ["UserContentNodeProgress", UserContentNodeProgress],
  ["UserUnitProgress", UserUnitProgress],
  ["UserTagApplication", UserTagApplication],
  ["RealmTagApplicationVote", RealmTagApplicationVote],
  ["RealmRuleAcknowledgement", RealmRuleAcknowledgement],
  ["StaffGrant", StaffGrant],
  ["RealmCapabilityGrant", RealmCapabilityGrant],
  ["UnitCollaborator", UnitCollaborator],
  ["UnitFieldLock", UnitFieldLock],
  ["HistoryOutbox", HistoryOutbox],
  ["UnitHistoryClock", UnitHistoryClock],

  ["AccountEnforcement", AccountEnforcement],
  ["ModerationAction", ModerationAction],
  ["ModerationCase", ModerationCase],
  ["Feedback", Feedback],

  ["CreditAttributionEvidence", CreditAttributionEvidence],
  ["GameSystemRequirement", GameSystemRequirement],
  ["UnitExternalRef", UnitExternalRef],
  ["SubjectAttribution", SubjectAttribution],
  ["CreditAttribution", CreditAttribution],

  ["ScoreRealmField", ScoreRealmField],
  ["ScoreAggregate", ScoreAggregate],
  ["PostPollReference", PostPollReference],
  ["PostUnitReference", PostUnitReference],
  ["PollOption", PollOption],

  ["RealmTagApplication", RealmTagApplication],
  ["RealmTagContext", RealmTagContext],

  ["UnitRealm", UnitRealm],
  ["RealmMember", RealmMember],
  ["ShelfItem", ShelfItem],
  ["UnitTag", UnitTag],

  ["SeriesContentIndex", SeriesContentIndex],
  ["ContentStructureAnchor", ContentStructureAnchor],
  ["ContentStructureNode", ContentStructureNode],
  ["ContentStructure", ContentStructure],
  ["SourceSite", SourceSite],

  ["CommentPromotion", CommentPromotion],
  ["Comment", Comment],
  ["Post", Post],
  ["ScoreEntry", ScoreEntry],
  ["Poll", Poll],
  ["Shelf", Shelf],
  ["Series", Series],
  ["Realm", Realm],
  ["Book", Book],
  ["Game", Game],
  ["Media", Media],
  ["Link", Link],
  ["Zone", Zone],
  ["Entity", Entity],

  ["ContentTranslation", ContentTranslation],
  ["UnitAlias", UnitAlias],
  ["UnitTranslation", UnitTranslation],
  ["UnitSupportLanguage", UnitSupportLanguage],

  ["SlugScope", SlugScope],
  ["Unit", Unit],
  ["User", User],

  ["EchoKV", EchoKV],
  ["Jwks", Jwks],
  ["JwtService", JwtService],
] as const satisfies readonly ResetTable[];

async function deleteTables(
  db: ResetDatabaseDb,
  tables: readonly ResetTable[],
): Promise<void> {
  await Promise.all(tables.map(([, table]) => db.delete(table)));
}

/**
 * Reset database by deleting all data in FK-safe order.
 * Groups at the same FK level are deleted in parallel.
 *
 * This wipes everything. Run the seed CLI afterward to recreate users and
 * infrastructure.
 */
export async function resetDatabase(db: ResetDatabaseDb): Promise<void> {
  console.log("[Reset] Resetting database...");

  // Group 1: Leaf tables with no dependents or only id-shaped references.
  await deleteTables(db, RESET_DATABASE_TABLES.slice(0, 20));

  // Group 2: Moderation and feedback records.
  await db.delete(AccountEnforcement);
  await db.delete(ModerationAction);
  await db.delete(ModerationCase);
  await db.delete(Feedback);

  // Group 3: Attribution and external-reference leaves.
  await deleteTables(db, [
    ["CreditAttributionEvidence", CreditAttributionEvidence],
    ["GameSystemRequirement", GameSystemRequirement],
  ]);
  await deleteTables(db, [
    ["UnitExternalRef", UnitExternalRef],
    ["SubjectAttribution", SubjectAttribution],
    ["CreditAttribution", CreditAttribution],
  ]);

  // Group 4: Poll, score, and tag leaves.
  await deleteTables(db, [
    ["ScoreRealmField", ScoreRealmField],
    ["ScoreAggregate", ScoreAggregate],
    ["PostPollReference", PostPollReference],
    ["PostUnitReference", PostUnitReference],
  ]);
  await db.delete(PollOption);

  // Group 5: Aggregate / junction leaves.
  await db.delete(RealmTagApplication);
  await db.delete(RealmTagContext);

  // Group 6: Realm + shelf + tag junctions.
  await deleteTables(db, [
    ["UnitRealm", UnitRealm],
    ["RealmMember", RealmMember],
    ["ShelfItem", ShelfItem],
    ["UnitTag", UnitTag],
  ]);

  // Group 7: Extension children.
  // ContentStructureNode rows hold FKs to ContentStructure; delete them first
  // so the parent delete in this group doesn't trip a constraint.
  await db.delete(SeriesContentIndex);
  await db.delete(ContentStructureAnchor);
  await db.delete(ContentStructureNode);
  await deleteTables(db, [
    ["ContentStructure", ContentStructure],
    ["SourceSite", SourceSite],
  ]);

  // Group 8: Type extensions (1:1 with Unit).
  // Post must be deleted before ScoreEntry (FK constraint)
  await db.delete(CommentPromotion);
  await db.delete(Comment);
  await db.delete(Post);
  await db.delete(ScoreEntry);
  await deleteTables(db, [
    ["Poll", Poll],
    ["Shelf", Shelf],
    ["Series", Series],
    ["Realm", Realm],
    ["Book", Book],
    ["Game", Game],
    ["Media", Media],
    ["Link", Link],
    ["Zone", Zone],
    ["Entity", Entity],
  ]);

  // Group 9: Translation layer.
  await deleteTables(db, [
    ["ContentTranslation", ContentTranslation],
    ["UnitAlias", UnitAlias],
    ["UnitTranslation", UnitTranslation],
    ["UnitSupportLanguage", UnitSupportLanguage],
  ]);

  // Group 10: Core.
  // Drop SlugScope rows first — they reference SCOPE Units; Unit.deleteMany
  // cascades only declared database FKs, but SlugScope.unitId has no FK.
  await db.delete(SlugScope);
  await db.delete(Unit);

  // Group 11: Identity.
  await db.delete(User);

  // Group 12: Platform misc.
  await deleteTables(db, [
    ["EchoKV", EchoKV],
    ["Jwks", Jwks],
  ]);
  await db.delete(JwtService);

  console.log("[Reset] Database reset complete.");
}
