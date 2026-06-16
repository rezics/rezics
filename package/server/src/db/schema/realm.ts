import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  createdAt,
  jsonData,
  nullableTimestamp,
  timestampMs,
  updatedAt,
  uuidv7PrimaryKey,
} from "./columns";
import { GovernanceGrantState } from "./governance";
import { User } from "./identity";
import { ModerationStatus } from "./moderation";
import { Unit } from "./unit";

export const realmMemberStateStorageValues = [
  "ACTIVE",
  "PENDING",
  "MUTED",
  "REMOVED",
  "BANNED",
] as const;

export type RealmMemberStateStorage =
  (typeof realmMemberStateStorageValues)[number];

export const RealmMemberState = pgEnum(
  "RealmMemberState",
  realmMemberStateStorageValues,
);

export const Realm = pgTable("Realm", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  isPublic: boolean().default(true).notNull(),
  isOfficial: boolean().default(false).notNull(),
  memberCount: integer().default(0).notNull(),
  extra: jsonData(),
  dock: jsonData(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  /**
   * Versioned rule policy for the POST Unit shown before realm joins/posts.
   * Dock widgets render this policy; they do not own a second rule pointer.
   */
  ruleUnitId: uuid().references(() => Unit.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  ruleVersion: integer().default(1).notNull(),
  ruleRequireOnJoin: boolean().default(false).notNull(),
  ruleRequireOnPost: boolean().default(false).notNull(),
  ruleRequireOnUpdate: boolean().default(true).notNull(),
  rulePolicyUpdatedAt: nullableTimestamp(),
  /**
   * New joins are stored as pending until a realm moderator approves them.
   * 新加入的成员以待处理状态存储，直到 realm 版主批准。
   */
  joinRequiresApproval: boolean().default(false).notNull(),
  /**
   * Author submissions enter the realm feed as pending review until approved.
   * 作者提交的内容以待审核状态进入 realm 信息流，直到获批。
   */
  contentRequiresApproval: boolean().default(false).notNull(),
});

export const RealmMember = pgTable(
  "RealmMember",
  {
    realmUnitId: uuid()
      .notNull()
      .references(() => Realm.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: uuid().notNull(),
    roleKey: varchar({ length: 32 }).notNull(),
    joinedAt: timestampMs().default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: updatedAt(),
    state: RealmMemberState().default("ACTIVE").notNull(),
    onboardingCompletedAt: nullableTimestamp(),
  },
  (table) => [
    primaryKey({
      columns: [table.realmUnitId, table.userId],
      name: "RealmMember_pkey",
    }),
    index("RealmMember_realmUnitId_roleKey_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.roleKey.asc().nullsLast(),
    ),
    index("RealmMember_realmUnitId_state_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.state.asc().nullsLast(),
    ),
    index("RealmMember_userId_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
    ),
  ],
);

export const RealmCapabilityGrant = pgTable(
  "RealmCapabilityGrant",
  {
    id: uuidv7PrimaryKey(),
    realmUnitId: uuid()
      .notNull()
      .references(() => Realm.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: uuid().notNull(),
    capability: varchar({ length: 96 }).notNull(),
    state: GovernanceGrantState().default("ACTIVE").notNull(),
    grantedById: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    revokedById: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    expiresAt: nullableTimestamp(),
    revokedAt: nullableTimestamp(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      columns: [table.realmUnitId, table.userId],
      foreignColumns: [RealmMember.realmUnitId, RealmMember.userId],
      name: "RealmCapabilityGrant_realmUnitId_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("RealmCapabilityGrant_grantedById_createdAt_idx").using(
      "btree",
      table.grantedById.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("RealmCapabilityGrant_realmUnitId_capability_state_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.capability.asc().nullsLast(),
      table.state.asc().nullsLast(),
    ),
    index("RealmCapabilityGrant_realmUnitId_userId_state_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.userId.asc().nullsLast(),
      table.state.asc().nullsLast(),
    ),
    index("RealmCapabilityGrant_revokedById_idx").using(
      "btree",
      table.revokedById.asc().nullsLast(),
    ),
    index("RealmCapabilityGrant_userId_capability_state_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.capability.asc().nullsLast(),
      table.state.asc().nullsLast(),
    ),
  ],
);

export const RealmRuleAcknowledgement = pgTable(
  "RealmRuleAcknowledgement",
  {
    realmUnitId: uuid()
      .notNull()
      .references(() => Realm.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    ruleUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    version: integer().notNull(),
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    acceptedLanguage: varchar({ length: 16 }),
    acceptedAt: timestampMs().default(sql`CURRENT_TIMESTAMP`).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.realmUnitId,
        table.ruleUnitId,
        table.version,
        table.userId,
      ],
      name: "RealmRuleAcknowledgement_pkey",
    }),
    index("RealmRuleAcknowledgement_realmUnitId_userId_acceptedAt_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.userId.asc().nullsLast(),
      table.acceptedAt.asc().nullsLast(),
    ),
    index("RealmRuleAcknowledgement_userId_acceptedAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.acceptedAt.asc().nullsLast(),
    ),
  ],
);

export const RealmTagContext = pgTable(
  "RealmTagContext",
  {
    /**
     * Pair-level explanatory surface for (realmUnitId, tagUnitId). The pair is
     * the identity; contextUnitId is only a materialized content carrier for
     * explanation, examples, discussion, and history.
     * (realmUnitId, tagUnitId) 配对级别的解释性载体。配对本身即身份标识；contextUnitId 仅是用于承载解释、示例、讨论和历史的物化内容载体。
     */
    realmUnitId: uuid()
      .notNull()
      .references(() => Realm.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    tagUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    contextUnitId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.realmUnitId, table.tagUnitId],
      name: "RealmTagContext_pkey",
    }),
    uniqueIndex("RealmTagContext_contextUnitId_key").using(
      "btree",
      table.contextUnitId.asc().nullsLast(),
    ),
    index("RealmTagContext_tagUnitId_idx").using(
      "btree",
      table.tagUnitId.asc().nullsLast(),
    ),
  ],
);

/**
 * Community/feed membership for a target Unit in a realm. This junction is not
 * semantic tagging and is not a prerequisite or owner relation for
 * RealmTagApplication.
 * realm 中目标 Unit 的社区/信息流成员关系。此连接表不是语义化标签，也不是 RealmTagApplication 的前置条件或所有者关系。
 */
export const UnitRealm = pgTable(
  "UnitRealm",
  {
    realmUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: createdAt(),
    isLocked: boolean().default(false).notNull(),
    /**
     * Realm-local moderation snapshot. REMOVED is soft deletion of this
     * Unit-realm relation; hard deletion removes the row.
     * realm 本地的审核状态快照。REMOVED 表示对此 Unit-realm 关系的软删除；硬删除则移除该行。
     */
    moderationStatus: ModerationStatus().default("APPROVED").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.realmUnitId, table.unitId],
      name: "UnitRealm_pkey",
    }),
    index("UnitRealm_realmUnitId_createdAt_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("UnitRealm_realmUnitId_moderationStatus_createdAt_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.moderationStatus.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index(
      "UnitRealm_realmUnitId_moderationStatus_isLocked_createdAt_idx",
    ).using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.moderationStatus.asc().nullsLast(),
      table.isLocked.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("UnitRealm_unitId_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
    ),
  ],
);
