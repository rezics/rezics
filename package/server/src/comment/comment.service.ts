import type {
  CommentListBody,
  CommentListContext,
  CommentListQuery,
  CommentSearchOptions,
  CreateCommentInput,
  UpdateCommentInput,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  notInArray,
  sql,
} from "drizzle-orm";
import { blockService } from "@/block/block.service";
import { serverJobProducer } from "@/job/job-boundary";
import { AppError } from "@/utils/errors";
import type { PublicUserSelected } from "@/utils/sanitizeUser";
import { Comment, CommentPromotion, Post, UnitRealm, User } from "../db/schema";
import type { CommentWithRelations } from "./comment.types";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
type CommentListInput = CommentListQuery | CommentListBody;

type CommentRow = typeof Comment.$inferSelect;
type CommentListRepositoryInput = {
  rootUnitId: string;
  context: CommentListContext;
  authorUserId?: string;
  state?: string;
  parentCommentId?: string | null;
  blockedAuthorIds?: string[];
  sort?: CommentListInput["sort"];
  cursor?: CommentListInput["cursor"];
  limit: number;
};
type CommentParentRow = Pick<
  CommentRow,
  "id" | "rootUnitId" | "realmUnitId" | "depth" | "isLocked"
>;
type UnitRealmContextRow = Pick<
  typeof UnitRealm.$inferSelect,
  "moderationStatus" | "isLocked"
>;

export type CommentRepository = {
  list(
    input: CommentListRepositoryInput,
  ): Promise<{ comments: CommentWithRelations[]; total: number }>;
  getById(id: string): Promise<CommentWithRelations>;
  getByIdsIncludingRedacted(ids: string[]): Promise<CommentWithRelations[]>;
  attachPinOverlays<
    T extends {
      id: string;
      rootUnitId: string;
      pinKind?: string | null;
      pinPosition?: string | null;
    },
  >(comments: T[]): Promise<T[]>;
  getParentForCreate(id: string): Promise<CommentParentRow>;
  getRealmContextForCreate(input: {
    realmUnitId: string;
    rootUnitId: string;
  }): Promise<UnitRealmContextRow | null>;
  create(input: {
    rootUnitId: string;
    realmUnitId: string | null;
    parentCommentId?: string | null;
    authorUserId: string;
    content: unknown;
    depth: number;
    parentId?: string;
  }): Promise<CommentWithRelations>;
  getUpdateIdentity(id: string): Promise<Pick<CommentRow, "authorUserId">>;
  update(id: string, input: UpdateCommentInput): Promise<CommentWithRelations>;
  getDeleteIdentity(id: string): Promise<Pick<CommentRow, "authorUserId">>;
  softDelete(id: string): Promise<void>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function publicAuthorColumns() {
  return {
    unitId: User.unitId,
    name: User.name,
    avatar: User.avatar,
    summary: User.summary,
    description: User.description,
    followersCount: User.followersCount,
    followingsCount: User.followingsCount,
  };
}

function mapCommentRow(row: {
  comment: CommentRow;
  author: PublicUserSelected | null;
}): CommentWithRelations {
  return {
    ...row.comment,
    author: row.author,
  };
}

/**
 * Context selector → SQL constraints. `all` adds no realm constraint, so
 * direct and realm-context comments interleave by the requested sort.
 * 语境选择器 → SQL 约束。`all` 不加 realm 约束，直接评论与 realm 语境评论
 * 按请求的排序交错。
 */
function contextConditions(context: CommentListContext) {
  if (context.kind === "direct") return [isNull(Comment.realmUnitId)];
  if (context.kind === "realm") {
    return [eq(Comment.realmUnitId, context.realmUnitId)];
  }
  return [];
}

function isInContext(
  comment: Pick<CommentRow, "realmUnitId">,
  context: CommentListContext,
) {
  if (context.kind === "direct") return comment.realmUnitId === null;
  if (context.kind === "realm") {
    return comment.realmUnitId === context.realmUnitId;
  }
  return true;
}

function cursorDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function commentCursorCondition(
  sort: CommentListInput["sort"],
  cursor?: CommentListInput["cursor"],
) {
  if (!cursor?.id) return undefined;
  const createdAt = cursorDate(cursor.createdAt);
  const id = cursor.id;

  if (sort === "old") {
    if (!createdAt) return sql`${Comment.id} > ${id}`;
    return sql`(${Comment.createdAt}, ${Comment.id}) > (${createdAt}, ${id})`;
  }

  if (
    sort === "top" ||
    sort === "best" ||
    sort === "rising" ||
    sort === "controversial"
  ) {
    const sortValue =
      typeof cursor.sortValue === "number" ? cursor.sortValue : undefined;
    if (sortValue === undefined || !createdAt) return lt(Comment.id, id);
    return sql`(${Comment.replyCount}, ${Comment.createdAt}, ${Comment.id}) < (${sortValue}, ${createdAt}, ${id})`;
  }

  if (!createdAt) return lt(Comment.id, id);
  return sql`(${Comment.createdAt}, ${Comment.id}) < (${createdAt}, ${id})`;
}

function createDrizzleCommentRepository(): CommentRepository {
  return {
    async list(input) {
      const db = await getServerDb();
      const conditions = [
        eq(Comment.rootUnitId, input.rootUnitId),
        ...contextConditions(input.context),
        eq(Comment.moderationStatus, "APPROVED"),
        isNull(Comment.deletedAt),
      ];
      if (input.authorUserId) {
        conditions.push(eq(Comment.authorUserId, input.authorUserId));
      }
      if (input.state) conditions.push(eq(Comment.state, input.state));
      if ("parentCommentId" in input) {
        conditions.push(
          input.parentCommentId
            ? eq(Comment.parentCommentId, input.parentCommentId)
            : isNull(Comment.parentCommentId),
        );
      }
      if (input.blockedAuthorIds?.length) {
        conditions.push(
          notInArray(Comment.authorUserId, input.blockedAuthorIds),
        );
      }

      const cursorCondition = commentCursorCondition(input.sort, input.cursor);
      const rowWhere = cursorCondition
        ? and(...conditions, cursorCondition)
        : and(...conditions);
      const totalWhere = and(...conditions);
      const orderBy =
        input.sort === "old"
          ? [asc(Comment.createdAt), asc(Comment.id)]
          : input.sort === "top" ||
              input.sort === "best" ||
              input.sort === "rising" ||
              input.sort === "controversial"
            ? [
                desc(Comment.replyCount),
                desc(Comment.createdAt),
                desc(Comment.id),
              ]
            : [desc(Comment.createdAt), desc(Comment.id)];
      const [rows, totalRows] = await Promise.all([
        db
          .select({ comment: Comment, author: publicAuthorColumns() })
          .from(Comment)
          .leftJoin(User, eq(Comment.authorUserId, User.unitId))
          .where(rowWhere)
          .orderBy(...orderBy)
          .limit(input.limit),
        db.select({ value: count() }).from(Comment).where(totalWhere),
      ]);

      return {
        comments: rows.map(mapCommentRow),
        total: totalRows[0]?.value ?? 0,
      };
    },
    async getById(id) {
      const db = await getServerDb();
      const [row] = await db
        .select({ comment: Comment, author: publicAuthorColumns() })
        .from(Comment)
        .leftJoin(User, eq(Comment.authorUserId, User.unitId))
        .where(eq(Comment.id, id))
        .limit(1);
      if (!row) throw new AppError(404, `Comment not found: ${id}`);
      return mapCommentRow(row);
    },
    async getByIdsIncludingRedacted(ids) {
      if (ids.length === 0) return [];
      const db = await getServerDb();
      const rows = await db
        .select({ comment: Comment, author: publicAuthorColumns() })
        .from(Comment)
        .leftJoin(User, eq(Comment.authorUserId, User.unitId))
        .where(inArray(Comment.id, ids));
      return rows.map(mapCommentRow);
    },
    async attachPinOverlays(comments) {
      if (comments.length === 0) return comments;
      const db = await getServerDb();
      const rootUnitIds = [
        ...new Set(comments.map((comment) => comment.rootUnitId)),
      ];
      const pins = await db
        .select({
          scopeUnitId: CommentPromotion.scopeUnitId,
          commentId: CommentPromotion.commentId,
          kind: CommentPromotion.kind,
          position: CommentPromotion.position,
        })
        .from(CommentPromotion)
        .where(
          and(
            inArray(CommentPromotion.scopeUnitId, rootUnitIds),
            inArray(
              CommentPromotion.commentId,
              comments.map((comment) => comment.id),
            ),
          ),
        );
      const pinByScopeAndComment = new Map(
        pins.map((pin) => [
          `${pin.scopeUnitId}:${pin.commentId}`,
          { kind: pin.kind, position: pin.position },
        ]),
      );
      for (const comment of comments) {
        const pin = pinByScopeAndComment.get(
          `${comment.rootUnitId}:${comment.id}`,
        );
        comment.pinKind = pin?.kind ?? null;
        comment.pinPosition = pin?.position ?? null;
      }
      return comments;
    },
    async getParentForCreate(id) {
      const db = await getServerDb();
      const [parent] = await db
        .select({
          id: Comment.id,
          rootUnitId: Comment.rootUnitId,
          realmUnitId: Comment.realmUnitId,
          depth: Comment.depth,
          isLocked: Comment.isLocked,
        })
        .from(Comment)
        .where(eq(Comment.id, id))
        .limit(1);
      if (!parent) throw new AppError(404, `Comment not found: ${id}`);
      return parent;
    },
    async getRealmContextForCreate({ realmUnitId, rootUnitId }) {
      const db = await getServerDb();
      const [row] = await db
        .select({
          moderationStatus: UnitRealm.moderationStatus,
          isLocked: UnitRealm.isLocked,
        })
        .from(UnitRealm)
        .where(
          and(
            eq(UnitRealm.realmUnitId, realmUnitId),
            eq(UnitRealm.unitId, rootUnitId),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async create(input) {
      const db = await getServerDb();
      const now = new Date();
      const commentId = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(Comment)
          .values({
            rootUnitId: input.rootUnitId,
            realmUnitId: input.realmUnitId,
            parentCommentId: input.parentCommentId ?? null,
            authorUserId: input.authorUserId,
            content: input.content,
            depth: input.depth,
            moderationStatus: "APPROVED",
            updatedAt: now,
          })
          .returning({ id: Comment.id });
        if (!created) throw new Error("Failed to create Comment");

        if (input.parentId) {
          await tx
            .update(Comment)
            .set({
              replyCount: sql`${Comment.replyCount} + 1`,
              directReplyCount: sql`${Comment.directReplyCount} + 1`,
              lastReplyAt: now,
              updatedAt: now,
            })
            .where(eq(Comment.id, input.parentId));
        }

        await tx
          .update(Post)
          .set({
            replyCount: sql`${Post.replyCount} + 1`,
            ...(input.parentId
              ? {}
              : { directReplyCount: sql`${Post.directReplyCount} + 1` }),
            lastReplyAt: now,
            updatedAt: now,
          })
          .where(eq(Post.unitId, input.rootUnitId));

        return created.id;
      });
      return this.getById(commentId);
    },
    async getUpdateIdentity(id) {
      const db = await getServerDb();
      const [existing] = await db
        .select({
          authorUserId: Comment.authorUserId,
        })
        .from(Comment)
        .where(eq(Comment.id, id))
        .limit(1);
      if (!existing) throw new AppError(404, `Comment not found: ${id}`);
      return existing;
    },
    async update(id, input) {
      const db = await getServerDb();
      const [updated] = await db
        .update(Comment)
        .set({
          ...(input.content !== undefined ? { content: input.content } : {}),
          ...(input.isLocked !== undefined ? { isLocked: input.isLocked } : {}),
          ...(input.state !== undefined ? { state: input.state } : {}),
          updatedAt: new Date(),
        })
        .where(eq(Comment.id, id))
        .returning();
      if (!updated) throw new AppError(404, `Comment not found: ${id}`);
      return this.getById(id);
    },
    async getDeleteIdentity(id) {
      const db = await getServerDb();
      const [existing] = await db
        .select({ authorUserId: Comment.authorUserId })
        .from(Comment)
        .where(eq(Comment.id, id))
        .limit(1);
      if (!existing) throw new AppError(404, `Comment not found: ${id}`);
      return existing;
    },
    async softDelete(id) {
      const db = await getServerDb();
      await db
        .update(Comment)
        .set({
          content: null,
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(Comment.id, id));
    },
  };
}

function commentSearchSortField(
  sort: CommentListInput["sort"],
): NonNullable<CommentSearchOptions["sort"]>["field"] {
  switch (sort) {
    case "best":
      return "bestScore";
    case "top":
      return "topScore";
    case "rising":
      return "risingScore";
    case "controversial":
      return "controversyScore";
    default:
      return "createdAt";
  }
}

function orderedByIds(
  comments: CommentWithRelations[],
  ids: readonly string[],
): CommentWithRelations[] {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  return ids.flatMap((id) => {
    const comment = byId.get(id);
    return comment ? [comment] : [];
  });
}

export function createSearchBackedCommentRepository(
  delegate: CommentRepository,
): CommentRepository {
  return {
    ...delegate,
    async list(input) {
      if (input.cursor || input.blockedAuthorIds?.length) {
        return delegate.list(input);
      }

      try {
        const { searchComments } = await import(
          "../meili/comment/comment.service"
        );
        // Search documents store null realmUnitId verbatim, so `direct` maps
        // to the Meili `realmUnitId IS NULL` filter and `all` omits the filter.
        // 搜索文档原样存储 null 的 realmUnitId，因此 `direct` 映射为 Meili 的
        // `realmUnitId IS NULL` 过滤器，`all` 则省略该过滤器。
        const result = await searchComments({
          rootUnitId: input.rootUnitId,
          ...(input.context.kind === "direct" ? { realmUnitId: null } : {}),
          ...(input.context.kind === "realm"
            ? { realmUnitId: input.context.realmUnitId }
            : {}),
          ...(input.parentCommentId !== undefined
            ? { parentCommentId: input.parentCommentId }
            : {}),
          authorUserId: input.authorUserId,
          state: input.state,
          moderationStatus: "APPROVED",
          sort: {
            field: commentSearchSortField(input.sort),
            order: input.sort === "old" ? "asc" : "desc",
          },
          limit: input.limit,
        });
        const ids = result.items.map((comment) => comment.id);
        const hydrated = await delegate.getByIdsIncludingRedacted(ids);
        const visible = orderedByIds(hydrated, ids).filter(
          (comment) =>
            comment.moderationStatus === "APPROVED" && !comment.deletedAt,
        );
        return {
          comments: visible,
          total: result.total,
        };
      } catch {
        return delegate.list(input);
      }
    },
  };
}

function createDefaultCommentRepository(): CommentRepository {
  return createSearchBackedCommentRepository(createDrizzleCommentRepository());
}

function enqueueCommentSync(commentId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.commentSync,
      { commentId },
      { type: "server", service: "comment" },
    ),
  );
}

function firstCommentOrThrow(
  comments: CommentWithRelations[],
  id: string,
): CommentWithRelations {
  const comment = comments[0];
  if (!comment) {
    throw new AppError(404, `Comment not found: ${id}`);
  }
  return comment;
}

async function blockedAuthorIds(options?: {
  viewerUserId?: string | null;
}): Promise<string[]> {
  if (!options?.viewerUserId) return [];
  return blockService.blockedUserIds(options.viewerUserId);
}

function directParentIds(
  comments: Pick<CommentWithRelations, "id" | "parentCommentId">[],
) {
  const commentIds = new Set(comments.map((comment) => comment.id));
  return [
    ...new Set(
      comments
        .map((comment) => comment.parentCommentId)
        .filter(
          (id): id is string => Boolean(id) && !commentIds.has(id as string),
        ),
    ),
  ];
}

function commentCursorFor(
  comment: CommentWithRelations | undefined,
  sort: CommentListInput["sort"],
): CommentListInput["cursor"] | null {
  if (!comment) return null;
  const createdAt =
    comment.createdAt instanceof Date
      ? comment.createdAt.toISOString()
      : comment.createdAt;
  return {
    id: comment.id,
    createdAt,
    ...(sort === "top" ||
    sort === "best" ||
    sort === "rising" ||
    sort === "controversial"
      ? { sortValue: comment.replyCount }
      : {}),
  };
}

async function directParentContexts(
  repository: CommentRepository,
  comments: CommentWithRelations[],
): Promise<CommentWithRelations[]> {
  const parentIds = directParentIds(comments);
  if (parentIds.length === 0) return [];
  return repository.getByIdsIncludingRedacted(parentIds);
}

type CommentSliceResult = {
  comments: CommentWithRelations[];
  total: number;
  rootComment?: CommentWithRelations | null;
  parentContexts?: CommentWithRelations[];
  nextCursor?: CommentListInput["cursor"] | null;
};

export class CommentService {
  constructor(
    private readonly repository: CommentRepository = createDefaultCommentRepository(),
  ) {}

  async list(
    query: CommentListInput,
    options?: { viewerUserId?: string | null },
  ): Promise<CommentSliceResult> {
    const limit = Math.max(
      1,
      Math.min(Number(query.limit ?? DEFAULT_LIMIT), MAX_LIMIT),
    );
    const context = query.context ?? { kind: "all" as const };
    let parentCommentId: string | null | undefined =
      query.mode === "discovery" ? undefined : (query.parentCommentId ?? null);
    let rootComment: CommentWithRelations | null | undefined;

    if (query.mode === "root") {
      if (!query.rootCommentId) {
        throw new AppError(400, "rootCommentId is required for root slices");
      }
      rootComment = await this.repository.getById(query.rootCommentId);
      if (
        rootComment.rootUnitId !== query.rootUnitId ||
        !isInContext(rootComment, context)
      ) {
        throw new AppError(
          400,
          "Root comment is outside the requested root/context partition",
        );
      }
      parentCommentId = rootComment.id;
    }

    if (query.mode === "children") {
      if (!query.parentCommentId) {
        throw new AppError(
          400,
          "parentCommentId is required for children slices",
        );
      }
      const parent = await this.repository.getById(query.parentCommentId);
      if (
        parent.rootUnitId !== query.rootUnitId ||
        !isInContext(parent, context)
      ) {
        throw new AppError(
          400,
          "Parent comment is outside the requested root/context partition",
        );
      }
      parentCommentId = parent.id;
      rootComment = parent;
    }

    const blockedIds = await blockedAuthorIds(options);
    const listed = await this.repository.list({
      rootUnitId: query.rootUnitId,
      context,
      authorUserId: query.authorUserId,
      state: query.state,
      ...(parentCommentId !== undefined ? { parentCommentId } : {}),
      blockedAuthorIds: blockedIds,
      sort: query.sort,
      cursor: query.cursor,
      limit: limit + 1,
    });

    const pageComments = listed.comments.slice(0, limit);
    const comments = await this.repository.attachPinOverlays(pageComments);
    const parentContexts =
      query.mode === "discovery"
        ? await this.repository.attachPinOverlays(
            await directParentContexts(this.repository, comments),
          )
        : [];

    return {
      comments,
      total: listed.total,
      rootComment,
      parentContexts,
      nextCursor:
        listed.comments.length > limit
          ? commentCursorFor(pageComments.at(-1), query.sort)
          : null,
    };
  }

  async getById(id: string): Promise<CommentWithRelations> {
    const comment = await this.repository.getById(id);
    const withPins = await this.repository.attachPinOverlays([comment]);
    return firstCommentOrThrow(withPins, id);
  }

  async create(
    input: CreateCommentInput,
    authorUserId: string,
  ): Promise<CommentWithRelations> {
    let depth = 1;

    const parent = input.parentCommentId
      ? await this.repository.getParentForCreate(input.parentCommentId)
      : null;

    if (parent) {
      if (parent.isLocked)
        throw new AppError(409, "Cannot reply to a locked comment");
      if (parent.rootUnitId !== input.rootUnitId) {
        throw new AppError(
          400,
          "Parent comment is outside the requested root/realm partition",
        );
      }
      // Replies always inherit the parent's context; a mismatched explicit
      // value is rejected instead of silently overwritten.
      // 回复始终继承父评论的语境；显式传入不一致的值会被拒绝而非静默覆盖。
      if (input.realmUnitId !== parent.realmUnitId) {
        throw new AppError(
          400,
          "Parent comment is outside the requested root/realm partition",
        );
      }
      depth = parent.depth + 1;
    } else if (input.realmUnitId !== null) {
      await this.assertRealmContextWritable(
        input.realmUnitId,
        input.rootUnitId,
      );
    }
    const realmUnitId = parent ? parent.realmUnitId : input.realmUnitId;

    const comment = await this.repository.create({
      rootUnitId: input.rootUnitId,
      realmUnitId,
      parentCommentId: input.parentCommentId,
      authorUserId,
      content: input.content,
      depth,
      parentId: parent?.id,
    });

    await enqueueCommentSync(comment.id);
    return comment;
  }

  /**
   * Realm write policy for root comments: the root unit must be an APPROVED
   * member of the realm (`UnitRealm`), and the membership must not be locked
   * (`UnitRealm.isLocked` is the realm-moderation lock on this unit's thread,
   * set via governance lock actions). `Realm.contentRequiresApproval` only
   * gates adding units to a realm, so membership + APPROVED is the policy here.
   * 根评论的 realm 写入策略：根 Unit 必须是该 realm 的 APPROVED 成员
   * （`UnitRealm`），且成员关系未被锁定（`UnitRealm.isLocked` 是 realm 审核
   * 对该 Unit 线程的锁，由治理锁定操作设置）。`Realm.contentRequiresApproval`
   * 只约束将 Unit 加入 realm，因此这里的策略就是成员关系 + APPROVED。
   */
  private async assertRealmContextWritable(
    realmUnitId: string,
    rootUnitId: string,
  ): Promise<void> {
    const membership = await this.repository.getRealmContextForCreate({
      realmUnitId,
      rootUnitId,
    });
    if (!membership || membership.moderationStatus !== "APPROVED") {
      throw new AppError(400, "Realm is not an approved context for this unit");
    }
    if (membership.isLocked) {
      throw new AppError(409, "Comments are locked in this realm context");
    }
  }

  async update(
    id: string,
    input: UpdateCommentInput,
    actorUserId: string,
  ): Promise<CommentWithRelations> {
    const existing = await this.repository.getUpdateIdentity(id);
    if (existing.authorUserId !== actorUserId) {
      throw new AppError(403, "Only the author can update this comment");
    }

    const updated = await this.repository.update(id, input);
    await enqueueCommentSync(id);
    return updated;
  }

  async delete(id: string, actorUserId: string): Promise<void> {
    const existing = await this.repository.getDeleteIdentity(id);
    if (existing.authorUserId !== actorUserId) {
      throw new AppError(403, "Only the author can delete this comment");
    }
    await this.repository.softDelete(id);
    await enqueueCommentSync(id);
  }
}

export const commentService = new CommentService();
