import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { Unit } from "./catalog";
import { User } from "./identity";
import { Realm } from "./realm";

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
    position: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
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
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
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
    position: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
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

export const RealmTagApplicationVote = pgTable(
  "RealmTagApplicationVote",
  {
    realmUnitId: uuid().notNull(),
    tagUnitId: uuid().notNull(),
    unitId: uuid().notNull(),
    userId: uuid().notNull(),
    value: integer().notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
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
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    tagUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
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
