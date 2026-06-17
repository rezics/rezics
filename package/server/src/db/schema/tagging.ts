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
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, jsonData, updatedAt, uuidv7PrimaryKey } from "./columns";
import { User } from "./identity";
import { Realm } from "./realm";
import { Unit } from "./unit";

export const policyTagRuleStateStorageValues = ["ACTIVE", "ARCHIVED"] as const;

export type PolicyTagRuleStateStorage =
  (typeof policyTagRuleStateStorageValues)[number];

export const PolicyTagRuleState = pgEnum(
  "PolicyTagRuleState",
  policyTagRuleStateStorageValues,
);

export const UnitTag = pgTable(
  "UnitTag",
  {
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    tagUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    score: integer().default(0).notNull(),
    voteCount: integer().default(0).notNull(),
    pinned: boolean().default(false).notNull(),
    position: text(), // Fractional Indexing
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.tagUnitId],
      name: "UnitTag_pkey",
    }),
    index("UnitTag_tagUnitId_score_idx").using(
      "btree",
      table.tagUnitId.asc().nullsLast(),
      table.score.asc().nullsLast(),
    ),
    index("UnitTag_unitId_pinned_position_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.pinned.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
    index("UnitTag_unitId_score_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.score.asc().nullsLast(),
    ),
  ],
);

export const TagVote = pgTable(
  "TagVote",
  {
    userId: uuid().notNull(),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    tagUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    value: integer().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.unitId, table.tagUnitId],
      name: "TagVote_pkey",
    }),
    index("TagVote_unitId_tagUnitId_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.tagUnitId.asc().nullsLast(),
    ),
  ],
);

export const RealmTagApplication = pgTable(
  "RealmTagApplication",
  {
    /**
     * Realm collective voting attitude on a (target Unit, TAG Unit) pair.
     * This is not the policy-managed tag application table and does not create
     * a realm-local tag identity.
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
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    score: integer().default(0).notNull(),
    voteCount: integer().default(0).notNull(),
    pinned: boolean().default(false).notNull(),
    position: text(), // Fractional Indexing
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.realmUnitId, table.tagUnitId, table.unitId],
      name: "RealmTagApplication_pkey",
    }),
    index("RealmTagApplication_realmUnitId_unitId_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
    index("RealmTagApplication_realmUnitId_unitId_pinned_position_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
      table.pinned.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
    index("RealmTagApplication_score_idx").using(
      "btree",
      table.score.asc().nullsLast(),
    ),
    index("RealmTagApplication_tagUnitId_realmUnitId_idx").using(
      "btree",
      table.tagUnitId.asc().nullsLast(),
      table.realmUnitId.asc().nullsLast(),
    ),
    index("RealmTagApplication_unitId_realmUnitId_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.realmUnitId.asc().nullsLast(),
    ),
  ],
);

/**
 * Member vote on a RealmTagApplication. The business target is the
 * (realmUnitId, tagUnitId, unitId) application, not three independent Unit
 * roles.
 */
export const RealmTagApplicationVote = pgTable(
  "RealmTagApplicationVote",
  {
    realmUnitId: uuid().notNull(),
    tagUnitId: uuid().notNull(),
    unitId: uuid().notNull(),
    userId: uuid().notNull(),
    value: integer().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.realmUnitId, table.tagUnitId, table.unitId, table.userId],
      name: "RealmTagApplicationVote_pkey",
    }),
    foreignKey({
      columns: [table.realmUnitId, table.tagUnitId, table.unitId],
      foreignColumns: [
        RealmTagApplication.realmUnitId,
        RealmTagApplication.tagUnitId,
        RealmTagApplication.unitId,
      ],
      name: "RealmTagApplicationVote_realmUnitId_tagUnitId_unitId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("RealmTagApplicationVote_userId_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
    ),
  ],
);

export const UserTagApplication = pgTable(
  "UserTagApplication",
  {
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    /**
     * User tags apply to the resolved interaction target Unit, not shelf-item
     * pairs or exact edition/source context.
     */
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    tagUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: text(), // Fractional Indexing
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.unitId, table.tagUnitId],
      name: "UserTagApplication_pkey",
    }),
    index("UserTagApplication_userId_tagUnitId_unitId_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.tagUnitId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
    index("UserTagApplication_userId_unitId_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
    index("UserTagApplication_userId_unitId_position_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
  ],
);

export const PolicyTagRule = pgTable(
  "PolicyTagRule",
  {
    id: uuidv7PrimaryKey(),
    /**
     * Sparse policy-control marker. Query strategy is owned by callers such as
     * realm tag pickers and list filters, not by this rule row.
     */
    scopeKind: text().notNull(),
    realmUnitId: uuid().references(() => Realm.unitId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    tagUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    state: PolicyTagRuleState().default("ACTIVE").notNull(),
    createdByUserId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    updatedByUserId: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    reason: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("PolicyTagRule_global_active_tagUnitId_key")
      .using("btree", table.tagUnitId.asc().nullsLast())
      .where(sql`("scopeKind" = 'global' AND "state" = 'ACTIVE')`),
    uniqueIndex("PolicyTagRule_realm_active_realmUnitId_tagUnitId_key")
      .using(
        "btree",
        table.realmUnitId.asc().nullsLast(),
        table.tagUnitId.asc().nullsLast(),
      )
      .where(sql`("scopeKind" = 'realm' AND "state" = 'ACTIVE')`),
    index("PolicyTagRule_scope_state_idx").using(
      "btree",
      table.scopeKind.asc().nullsLast(),
      table.realmUnitId.asc().nullsLast(),
      table.state.asc().nullsLast(),
    ),
    index("PolicyTagRule_tagUnitId_state_idx").using(
      "btree",
      table.tagUnitId.asc().nullsLast(),
      table.state.asc().nullsLast(),
    ),
  ],
);

export const PolicyTagApplication = pgTable(
  "PolicyTagApplication",
  {
    id: uuidv7PrimaryKey(),
    ruleId: uuid()
      .notNull()
      .references(() => PolicyTagRule.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: text(),
    metadata: jsonData(),
    appliedByUserId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    updatedByUserId: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("PolicyTagApplication_ruleId_unitId_key").using(
      "btree",
      table.ruleId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
    index("PolicyTagApplication_ruleId_position_createdAt_unitId_idx").using(
      "btree",
      table.ruleId.asc().nullsLast(),
      table.position.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
    index("PolicyTagApplication_unitId_ruleId_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.ruleId.asc().nullsLast(),
    ),
  ],
);
