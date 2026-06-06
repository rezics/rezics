import { pinKindValues, postKindValues } from "@rezics/contract";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, jsonData, nullableTimestamp, updatedAt } from "./columns";
import { ScoreEntry } from "./score";
import { Unit } from "./unit";

export const PostKind = pgEnum("PostKind", postKindValues);

export const PinKind = pgEnum("PinKind", pinKindValues);

export const Post = pgTable(
  "Post",
  {
    unitId: uuid()
      .primaryKey()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    authorUserId: uuid().notNull(),
    scoreEntryId: uuid().references(() => ScoreEntry.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    kind: PostKind(),
    replyCount: integer().default(0).notNull(),
    directReplyCount: integer().default(0).notNull(),
    lastReplyAt: nullableTimestamp(),
    isLocked: boolean().default(false).notNull(),
    extra: jsonData(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    state: text(),
    variantUnitId: uuid(),
  },
  (table) => [
    index("Post_authorUserId_createdAt_idx").using(
      "btree",
      table.authorUserId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Post_kind_createdAt_idx").using(
      "btree",
      table.kind.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Post_scoreEntryId_idx").using(
      "btree",
      table.scoreEntryId.asc().nullsLast(),
    ),
    index("Post_variantUnitId_idx").using(
      "btree",
      table.variantUnitId.asc().nullsLast(),
    ),
  ],
);

export const PostPollReference = pgTable(
  "PostPollReference",
  {
    postUnitId: uuid().notNull(),
    pollUnitId: uuid().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.postUnitId, table.pollUnitId],
      name: "PostPollReference_pkey",
    }),
    index("PostPollReference_pollUnitId_idx").using(
      "btree",
      table.pollUnitId.asc().nullsLast(),
    ),
    index("PostPollReference_postUnitId_idx").using(
      "btree",
      table.postUnitId.asc().nullsLast(),
    ),
  ],
);

export const PostUnitReference = pgTable(
  "PostUnitReference",
  {
    sourcePostUnitId: uuid().notNull(),
    targetUnitId: uuid().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.sourcePostUnitId, table.targetUnitId],
      name: "PostUnitReference_pkey",
    }),
    index("PostUnitReference_sourcePostUnitId_idx").using(
      "btree",
      table.sourcePostUnitId.asc().nullsLast(),
    ),
    index("PostUnitReference_targetUnitId_idx").using(
      "btree",
      table.targetUnitId.asc().nullsLast(),
    ),
  ],
);
