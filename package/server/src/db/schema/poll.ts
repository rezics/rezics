import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { Unit } from "./catalog";
import { PollResultVisibility, PollVoteMode } from "./enums";

export const Poll = pgTable("Poll", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  voteMode: PollVoteMode().default("SINGLE").notNull(),
  resultVisibility: PollResultVisibility().default("LIVE").notNull(),
  anonymous: boolean().default(false).notNull(),
  closesAt: timestamp({ precision: 3 }),
  createdAt: timestamp({ precision: 3 })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ precision: 3 }).notNull(),
  usageCount: integer().default(0).notNull(),
});

export const PollOption = pgTable(
  "PollOption",
  {
    pollUnitId: uuid()
      .notNull()
      .references(() => Poll.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    optionId: uuid().default(sql`uuidv7()`).notNull(),
    position: varchar({ length: 64 }).notNull(),
    voteCount: integer().default(0).notNull(),
    label: text(),
    unitId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.pollUnitId, table.optionId],
      name: "PollOption_pkey",
    }),
    index("PollOption_pollUnitId_position_idx").using(
      "btree",
      table.pollUnitId.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
    index("PollOption_unitId_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
    ),
  ],
);

export const PollVote = pgTable(
  "PollVote",
  {
    pollUnitId: uuid()
      .notNull()
      .references(() => Poll.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: uuid().notNull(),
    optionId: uuid().notNull(),
    voteMode: PollVoteMode().notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    realmUnitId: uuid(),
  },
  (table) => [
    foreignKey({
      columns: [table.pollUnitId, table.optionId],
      foreignColumns: [PollOption.pollUnitId, PollOption.optionId],
      name: "PollVote_pollUnitId_optionId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("PollVote_pollUnitId_optionId_idx").using(
      "btree",
      table.pollUnitId.asc().nullsLast(),
      table.optionId.asc().nullsLast(),
    ),
    index("PollVote_pollUnitId_realmUnitId_optionId_idx").using(
      "btree",
      table.pollUnitId.asc().nullsLast(),
      table.realmUnitId.asc().nullsLast(),
      table.optionId.asc().nullsLast(),
    ),
    index("PollVote_pollUnitId_userId_idx").using(
      "btree",
      table.pollUnitId.asc().nullsLast(),
      table.userId.asc().nullsLast(),
    ),
    uniqueIndex("PollVote_pollUnitId_userId_optionId_key").using(
      "btree",
      table.pollUnitId.asc().nullsLast(),
      table.userId.asc().nullsLast(),
      table.optionId.asc().nullsLast(),
    ),
    uniqueIndex("PollVote_single_choice_uniq")
      .using(
        "btree",
        table.pollUnitId.asc().nullsLast(),
        table.userId.asc().nullsLast(),
      )
      .where(sql`("voteMode" = 'SINGLE'::"PollVoteMode")`),
    index("PollVote_userId_idx").using("btree", table.userId.asc().nullsLast()),
  ],
);
