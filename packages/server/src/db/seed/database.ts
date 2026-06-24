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
  RealmRuleItem,
  RealmRulePolicy,
  RealmRuleRevision,
  RealmTagTree,
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
  StaffAuditLog,
  StaffGrant,
  SubjectAttribution,
  Subscription,
  TagVote,
  Unit,
  UnitAlias,
  UnitAliasVote,
  UnitCollaborator,
  UnitExternalLink,
  UnitFieldLock,
  UnitHistoryClock,
  UnitRealm,
  UnitSupportLanguage,
  UnitTag,
  UnitTranslation,
  User,
  UserBlock,
  UserContentNodeProgress,
  UserSubscriptionListEntry,
  UserTagApplication,
  UserUnitProgress,
  Zone,
  ZonePage,
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
  ["UserSubscriptionListEntry", UserSubscriptionListEntry],
  ["UserContentNodeProgress", UserContentNodeProgress],
  ["UserUnitProgress", UserUnitProgress],
  ["UserTagApplication", UserTagApplication],
  ["RealmTagApplicationVote", RealmTagApplicationVote],
  ["RealmRuleAcknowledgement", RealmRuleAcknowledgement],
  ["RealmRuleItem", RealmRuleItem],
  ["RealmRuleRevision", RealmRuleRevision],
  ["RealmRulePolicy", RealmRulePolicy],
  ["RealmTagTree", RealmTagTree],
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
  ["UnitExternalLink", UnitExternalLink],
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
  ["ZonePage", ZonePage],
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
 * 按外键安全顺序删除全部数据以重置数据库。
 * 处于同一外键层级的分组并行删除。
 *
 * 这会清空所有数据。之后请运行 seed CLI 以重新创建用户和基础设施。
 */
export async function resetDatabase(db: ResetDatabaseDb): Promise<void> {
  console.log("[Reset] Resetting database...");

  // Group 1: Leaf tables with no dependents or only id-shaped references.
  // 第 1 组：没有依赖者、或仅含 id 形式引用的叶子表。
  await deleteTables(db, RESET_DATABASE_TABLES.slice(0, 21));

  // Group 2: Moderation and feedback records.
  // 第 2 组：审核与反馈记录。
  await db.delete(AccountEnforcement);
  await db.delete(ModerationAction);
  await db.delete(ModerationCase);
  await db.delete(Feedback);

  // Group 3: Attribution and external-link leaves.
  // 第 3 组：归属与外部链接叶子表。
  await deleteTables(db, [
    ["CreditAttributionEvidence", CreditAttributionEvidence],
    ["GameSystemRequirement", GameSystemRequirement],
    ["UnitExternalLink", UnitExternalLink],
  ]);
  await deleteTables(db, [
    ["SubjectAttribution", SubjectAttribution],
    ["CreditAttribution", CreditAttribution],
  ]);

  // Group 4: Poll, score, and tag leaves.
  // 第 4 组：投票、评分与标签叶子表。
  await deleteTables(db, [
    ["ScoreRealmField", ScoreRealmField],
    ["ScoreAggregate", ScoreAggregate],
    ["PostPollReference", PostPollReference],
    ["PostUnitReference", PostUnitReference],
  ]);
  await db.delete(PollOption);

  // Group 5: Aggregate / junction leaves.
  // 第 5 组：聚合 / 关联表叶子表。
  await db.delete(RealmTagApplication);
  await db.delete(RealmTagContext);
  await db.delete(RealmRuleAcknowledgement);
  await db.delete(RealmRuleItem);
  await db.delete(RealmRuleRevision);
  await db.delete(RealmRulePolicy);
  await db.delete(RealmTagTree);

  // Group 6: Realm + shelf + tag junctions.
  // 第 6 组：realm + 书架 + 标签关联表。
  await deleteTables(db, [
    ["UnitRealm", UnitRealm],
    ["RealmMember", RealmMember],
    ["ShelfItem", ShelfItem],
    ["UnitTag", UnitTag],
  ]);

  // Group 7: Extension children.
  // ContentStructureNode rows hold FKs to ContentStructure; delete them first
  // so the parent delete in this group doesn't trip a constraint.
  // 第 7 组：扩展子表。
  // ContentStructureNode 行持有指向 ContentStructure 的外键；先删除它们，
  // 这样本组中对父表的删除才不会触发约束错误。
  await db.delete(SeriesContentIndex);
  await db.delete(ContentStructureAnchor);
  await db.delete(ContentStructureNode);
  await db.delete(ContentStructure);

  // Group 8: Type extensions (1:1 with Unit).
  // Post must be deleted before ScoreEntry (FK constraint)
  // 第 8 组：类型扩展（与 Unit 为 1:1）。
  // Post 必须在 ScoreEntry 之前删除（外键约束）。
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
    ["ZonePage", ZonePage],
    ["Zone", Zone],
    ["Entity", Entity],
  ]);

  // Group 9: Translation layer.
  // 第 9 组：翻译层。
  await deleteTables(db, [
    ["ContentTranslation", ContentTranslation],
    ["UnitAlias", UnitAlias],
    ["UnitTranslation", UnitTranslation],
    ["UnitSupportLanguage", UnitSupportLanguage],
  ]);

  // Group 10: Core.
  // Drop SlugScope rows first — they reference SCOPE Units; Unit.deleteMany
  // cascades only declared database FKs, but SlugScope.unitId has no FK.
  // 第 10 组：核心。
  // 先删除 SlugScope 行——它们引用 SCOPE Units；Unit.deleteMany 仅级联已声明的
  // 数据库外键，而 SlugScope.unitId 没有外键。
  await db.delete(SlugScope);
  await db.delete(Unit);

  // Group 11: Identity.
  // 第 11 组：身份。
  await db.delete(User);

  // Group 12: Platform misc.
  // 第 12 组：平台杂项。
  await deleteTables(db, [
    ["EchoKV", EchoKV],
    ["Jwks", Jwks],
  ]);
  await db.delete(JwtService);

  console.log("[Reset] Database reset complete.");
}
