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
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { Unit } from "./catalog";
import { ltree } from "./custom-types";
import { ModerationStatus, PinKind, PostKind } from "./enums";
import { User } from "./identity";
import { ScoreEntry } from "./score";

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

export const Comment = pgTable(
  "Comment",
  {
    id: uuidv7PrimaryKey(),
    rootUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    realmUnitId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    parentCommentId: uuid(),
    authorUserId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    content: jsonData(),
    depth: integer().default(1).notNull(),
    path: ltree(),
    replyCount: integer().default(0).notNull(),
    directReplyCount: integer().default(0).notNull(),
    lastReplyAt: nullableTimestamp(),
    isLocked: boolean().default(false).notNull(),
    state: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: nullableTimestamp(),
    moderationStatus: ModerationStatus().default("APPROVED").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentCommentId],
      foreignColumns: [table.id],
      name: "Comment_parentCommentId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    index("Comment_authorUserId_createdAt_idx").using(
      "btree",
      table.authorUserId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Comment_deletedAt_idx").using(
      "btree",
      table.deletedAt.asc().nullsLast(),
    ),
    index("Comment_moderationStatus_idx").using(
      "btree",
      table.moderationStatus.asc().nullsLast(),
    ),
    index("Comment_parentCommentId_createdAt_idx").using(
      "btree",
      table.parentCommentId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Comment_path_gist_idx").using("gist", table.path.asc().nullsLast()),
    index("Comment_rootUnitId_realmUnitId_createdAt_idx").using(
      "btree",
      table.rootUnitId.asc().nullsLast(),
      table.realmUnitId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Comment_rootUnitId_realmUnitId_parentCommentId_createdAt_idx").using(
      "btree",
      table.rootUnitId.asc().nullsLast(),
      table.realmUnitId.asc().nullsLast(),
      table.parentCommentId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Comment_state_idx").using("btree", table.state.asc().nullsLast()),
  ],
);

export const CommentPromotion = pgTable(
  "CommentPromotion",
  {
    scopeUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    commentId: uuid()
      .notNull()
      .references(() => Comment.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    kind: PinKind().notNull(),
    position: varchar({ length: 64 }).notNull(),
    byUserId: uuid().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.scopeUnitId, table.commentId],
      name: "CommentPromotion_pkey",
    }),
    index("CommentPromotion_commentId_idx").using(
      "btree",
      table.commentId.asc().nullsLast(),
    ),
    index("CommentPromotion_scopeUnitId_kind_position_idx").using(
      "btree",
      table.scopeUnitId.asc().nullsLast(),
      table.kind.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
  ],
);
