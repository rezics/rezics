import {
  createdAt,
  jsonData,
  nullableTimestamp,
  timestampMs,
  updatedAt,
  uuidv7PrimaryKey,
} from "./columns";
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { Unit } from "./catalog";
import {
  GovernanceGrantState,
  ModerationStatus,
  RealmMemberState,
} from "./enums";
import { User } from "./identity";

export const Realm = pgTable("Realm", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  isPublic: boolean().default(true).notNull(),
  isOfficial: boolean().default(false).notNull(),
  memberCount: integer().default(0).notNull(),
  extra: jsonData(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  ruleVersion: integer().default(1).notNull(),
  ruleRequireOnJoin: boolean().default(false).notNull(),
  ruleRequireOnPost: boolean().default(false).notNull(),
  ruleRequireOnUpdate: boolean().default(true).notNull(),
  rulePolicyUpdatedAt: nullableTimestamp(),
  joinRequiresApproval: boolean().default(false).notNull(),
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
