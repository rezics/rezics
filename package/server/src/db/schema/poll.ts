import {
  pollResultVisibilityValues,
  pollVoteModeValues,
} from "@rezics/contract";
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
  nullableTimestamp,
  timestampMs,
  updatedAt,
  uuidv7,
  uuidv7PrimaryKey,
} from "./columns";
import { Unit } from "./unit";

/**
 * Poll voting follows the scored-junction plus per-user vote-row pattern used
 * by tags. Only the act of polling is a Unit; options and votes are plain rows.
 */
export const PollVoteMode = pgEnum("PollVoteMode", pollVoteModeValues);

export const PollResultVisibility = pgEnum(
  "PollResultVisibility",
  pollResultVisibilityValues,
);

export const Poll = pgTable("Poll", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  voteMode: PollVoteMode().default("SINGLE").notNull(),
  resultVisibility: PollResultVisibility().default("LIVE").notNull(),
  /**
   * Anonymity is a read-path/presentation guarantee, not reduced storage:
   * PollVote still records userId. No read path may expose the user-option
   * mapping when this is true.
   */
  anonymous: boolean().default(false).notNull(),
  /**
   * When the poll stops accepting votes and, for AFTER_CLOSE, reveals tallies.
   * Null means open indefinitely until explicitly closed.
   */
  closesAt: nullableTimestamp(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  usageCount: integer().default(0).notNull(),
});

/**
 * One poll option. Dual-form: exactly one of label or unitId is set. This is
 * not a Unit; voteCount is the denormalized tally maintained on vote changes.
 */
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
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

/**
 * A per-user vote. Always stores userId, even for anonymous polls, to guarantee
 * one-vote-per-user and allow vote changes. SINGLE exclusivity is enforced by
 * the partial unique index below.
 */
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
    createdAt: createdAt(),
    id: uuidv7PrimaryKey(),
    /**
     * Optional voting context for statistics and future realm-aware voting. It
     * is metadata, not poll ownership.
     */
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
