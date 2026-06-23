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
  updatedAt,
  uuidv7PrimaryKey,
} from "./columns.ts";
import { Unit } from "./unit.ts";

// Inlined from @rezics/contract
// 从 @rezics/contract 内联
const pollVoteModeValues = ["SINGLE", "MULTI"] as const;
const pollResultVisibilityValues = ["LIVE", "AFTER_CLOSE"] as const;

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
   * Anonymity is a read-path/presentation guarantee, not reduced storage.
   * 匿名性是读取路径/展示层面的保证，而非减少存储。
   */
  anonymous: boolean().default(false).notNull(),
  /**
   * When the poll stops accepting votes. Null means open indefinitely.
   * 投票何时停止接受投票。Null 表示无限期开放。
   */
  closesAt: nullableTimestamp(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  usageCount: integer().default(0).notNull(),
});

/**
 * One poll option. Dual-form: exactly one of label or unitId is set.
 * 一个投票选项。双形态：label 与 unitId 中恰好设置一个。
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
    position: varchar({ length: 64 }).notNull(), // Fractional Indexing
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
 * A per-user vote.
 * 每个用户的投票。
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
     * Optional voting context for statistics and future realm-aware voting.
     * 可选的投票上下文，用于统计和未来的 realm 感知投票。
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
