import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
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
} from "./columns.ts";
import { GovernanceGrantState } from "./governance.ts";
import { User } from "./identity.ts";
import { ModerationStatus } from "./moderation.ts";
import { Unit } from "./unit.ts";

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

export const RealmTagTree = pgTable("RealmTagTree", {
  realmUnitId: uuid()
    .primaryKey()
    .references(() => Realm.unitId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  tree: jsonData().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const RealmRulePolicy = pgTable(
  "RealmRulePolicy",
  {
    id: uuidv7PrimaryKey(),
    realmUnitId: uuid()
      .notNull()
      .references(() => Realm.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    currentRevisionId: uuid(),
    requireOnJoin: boolean().default(false).notNull(),
    requireOnPost: boolean().default(false).notNull(),
    requireOnUpdate: boolean().default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("RealmRulePolicy_realmUnitId_key").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
    ),
    index("RealmRulePolicy_currentRevisionId_idx").using(
      "btree",
      table.currentRevisionId.asc().nullsLast(),
    ),
  ],
);

export const RealmRuleRevision = pgTable(
  "RealmRuleRevision",
  {
    id: uuidv7PrimaryKey(),
    policyId: uuid()
      .notNull()
      .references(() => RealmRulePolicy.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    version: integer().notNull(),
    createdByUserId: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("RealmRuleRevision_policyId_version_key").using(
      "btree",
      table.policyId.asc().nullsLast(),
      table.version.asc().nullsLast(),
    ),
    index("RealmRuleRevision_policyId_createdAt_idx").using(
      "btree",
      table.policyId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
  ],
);

export const RealmRuleItem = pgTable(
  "RealmRuleItem",
  {
    id: uuidv7PrimaryKey(),
    policyId: uuid()
      .notNull()
      .references(() => RealmRulePolicy.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    revisionId: uuid()
      .notNull()
      .references(() => RealmRuleRevision.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    rulePostUnitId: uuid()
      .notNull()
      .references(() => Unit.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    position: text().notNull(),
    appliesTo: varchar({ length: 32 }),
    reportReasonUnitId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("RealmRuleItem_revisionId_position_idx").using(
      "btree",
      table.revisionId.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
    index("RealmRuleItem_rulePostUnitId_idx").using(
      "btree",
      table.rulePostUnitId.asc().nullsLast(),
    ),
  ],
);

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
    policyId: uuid()
      .notNull()
      .references(() => RealmRulePolicy.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    revisionId: uuid()
      .notNull()
      .references(() => RealmRuleRevision.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
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
        table.policyId,
        table.revisionId,
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
     * Pair-level explanatory surface for (realmUnitId, tagUnitId).
     * (realmUnitId, tagUnitId) 配对级别的解释性载体。
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
 * Community/feed membership for a target Unit in a realm.
 * realm 中目标 Unit 的社区/信息流成员关系。
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
     * Realm-local moderation snapshot.
     * realm 本地的审核状态快照。
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
