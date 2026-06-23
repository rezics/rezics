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
import {
  createdAt,
  jsonData,
  nullableTimestamp,
  updatedAt,
  uuidv7PrimaryKey,
} from "./columns.ts";
import { User } from "./identity.ts";
import { ModerationStatus } from "./moderation.ts";
import { PinKind } from "./post.ts";
import { Unit } from "./unit.ts";

// Inlined from @rezics/contract
// 从 @rezics/contract 内联
const DEFAULT_LANGUAGE = "zh-hant";

/**
 * Lightweight reply tree node.
 * 轻量级回复树节点。
 */
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
    /**
     * Canonical ContentDoc JSON.
     * 规范 ContentDoc JSON。
     */
    content: jsonData(),
    language: text().default(DEFAULT_LANGUAGE).notNull(),
    depth: integer().default(1).notNull(),
    replyCount: integer().default(0).notNull(),
    directReplyCount: integer().default(0).notNull(),
    lastReplyAt: nullableTimestamp(),
    isLocked: boolean().default(false).notNull(),
    state: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    /**
     * Author self-delete is separate from moderator removal.
     * 作者自删除与版主移除分开处理。
     */
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
    index("Comment_language_idx").using(
      "btree",
      table.language.asc().nullsLast(),
    ),
    index("Comment_parentCommentId_createdAt_idx").using(
      "btree",
      table.parentCommentId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
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
      table.id.asc().nullsLast(),
    ),
    index("Comment_state_idx").using("btree", table.state.asc().nullsLast()),
  ],
);

/**
 * Generic in-thread promotion of a comment.
 * 主题内评论的通用推荐。
 */
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
    position: varchar({ length: 64 }).notNull(), // Fractional Indexing
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
