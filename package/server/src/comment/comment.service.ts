import type {
  CommentListBody,
  CommentListQuery,
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
  isNotNull,
  isNull,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { blockService } from "@/block/block.service";
import { serverJobProducer } from "@/job/job-boundary";
import { AppError } from "@/utils/errors";
import type { PublicUserSelected } from "@/utils/sanitizeUser";
import { Comment, CommentPromotion, Post, User } from "../db/schema";
import type { CommentWithRelations } from "./comment.types";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
type CommentListInput = Omit<CommentListQuery, "ids"> & {
  ids?: CommentListQuery["ids"] | CommentListBody["ids"];
};

type CommentRow = typeof Comment.$inferSelect;
type CommentListRepositoryInput = {
  rootUnitId: string;
  realmUnitId: string | null;
  authorUserId?: string;
  state?: string;
  ids?: string[];
  maxDepth?: number;
  parentCommentId?: string | null;
  blockedAuthorIds?: string[];
  sort?: CommentListInput["sort"];
  limit: number;
};
type CommentParentRow = Pick<
  CommentRow,
  "id" | "rootUnitId" | "realmUnitId" | "depth" | "isLocked"
>;

export type CommentRepository = {
  list(
    input: CommentListRepositoryInput,
  ): Promise<{ comments: CommentWithRelations[]; total: number }>;
  getById(id: string): Promise<CommentWithRelations>;
  getSubtreeAnchor(input: {
    id: string;
    rootUnitId: string;
    realmUnitId: string | null;
  }): Promise<{ id: string; depth: number; path: string | null } | null>;
  listSubtreeDescendantIds(input: {
    anchor: { id: string; depth: number; path: string };
    rootUnitId: string;
    realmUnitId: string | null;
    maxDepth?: number;
  }): Promise<string[]>;
  findRedactedAncestors(ids: string[]): Promise<CommentWithRelations[]>;
  attachPaths<T extends { id: string; path?: string | null }>(
    comments: T[],
  ): Promise<T[]>;
  attachPinOverlays<
    T extends {
      id: string;
      rootUnitId: string;
      pinKind?: string | null;
      pinPosition?: string | null;
    },
  >(comments: T[]): Promise<T[]>;
  getParentForCreate(id: string): Promise<CommentParentRow>;
  create(input: {
    rootUnitId: string;
    realmUnitId: string | null;
    parentCommentId?: string | null;
    authorUserId: string;
    content: unknown;
    depth: number;
    parentId?: string;
  }): Promise<CommentWithRelations>;
  getUpdateIdentity(
    id: string,
  ): Promise<Pick<CommentRow, "authorUserId" | "realmUnitId">>;
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
    bio: User.bio,
    description: User.description,
    followersCount: User.followersCount,
    followingsCount: User.followingsCount,
  };
}

function mapCommentRow(row: {
  comment: CommentRow;
  author: PublicUserSelected | null;
}): CommentWithRelations {
  const path = row.comment.path;
  return {
    ...row.comment,
    path: typeof path === "string" ? path : null,
    author: row.author,
  };
}

function realmPartitionCondition(realmUnitId: string | null) {
  return realmUnitId
    ? eq(Comment.realmUnitId, realmUnitId)
    : isNull(Comment.realmUnitId);
}

function createDrizzleCommentRepository(): CommentRepository {
  return {
    async list(input) {
      if (input.ids && input.ids.length === 0) {
        return { comments: [], total: 0 };
      }

      const db = await getServerDb();
      const conditions = [
        eq(Comment.rootUnitId, input.rootUnitId),
        realmPartitionCondition(input.realmUnitId),
        eq(Comment.moderationStatus, "APPROVED"),
        isNull(Comment.deletedAt),
      ];
      if (input.authorUserId) {
        conditions.push(eq(Comment.authorUserId, input.authorUserId));
      }
      if (input.state) conditions.push(eq(Comment.state, input.state));
      if (input.ids?.length) conditions.push(inArray(Comment.id, input.ids));
      if (typeof input.maxDepth === "number") {
        conditions.push(lte(Comment.depth, input.maxDepth));
      }
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

      const where = and(...conditions);
      const orderBy =
        input.sort === "top" || input.sort === "hot"
          ? [desc(Comment.replyCount), desc(Comment.createdAt)]
          : [asc(Comment.createdAt)];
      const [rows, totalRows] = await Promise.all([
        db
          .select({ comment: Comment, author: publicAuthorColumns() })
          .from(Comment)
          .leftJoin(User, eq(Comment.authorUserId, User.unitId))
          .where(where)
          .orderBy(...orderBy)
          .limit(input.limit),
        db.select({ value: count() }).from(Comment).where(where),
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
    async getSubtreeAnchor(input) {
      const db = await getServerDb();
      const result = await db.execute<{
        id: string;
        depth: number;
        path: string | null;
      }>(sql`
        SELECT "id", "depth", "path"::text AS path
        FROM "Comment"
        WHERE "id" = ${input.id}::uuid
          AND "rootUnitId" = ${input.rootUnitId}::uuid
          AND "realmUnitId" IS NOT DISTINCT FROM ${input.realmUnitId}::uuid
        LIMIT 1
      `);
      return result.rows[0] ?? null;
    },
    async listSubtreeDescendantIds(input) {
      const db = await getServerDb();
      const result = await db.execute<{ id: string }>(sql`
        SELECT "id" FROM "Comment"
        WHERE "path" <@ ${input.anchor.path}::ltree
          AND "rootUnitId" = ${input.rootUnitId}::uuid
          AND "realmUnitId" IS NOT DISTINCT FROM ${input.realmUnitId}::uuid
          AND "id" <> ${input.anchor.id}::uuid
          ${
            typeof input.maxDepth === "number"
              ? sql`AND "depth" <= ${input.anchor.depth + input.maxDepth}`
              : sql``
          }
      `);
      return result.rows.map((row) => row.id);
    },
    async findRedactedAncestors(ids) {
      if (ids.length === 0) return [];
      const db = await getServerDb();
      const rows = await db
        .select({ comment: Comment, author: publicAuthorColumns() })
        .from(Comment)
        .leftJoin(User, eq(Comment.authorUserId, User.unitId))
        .where(
          and(
            inArray(Comment.id, ids),
            or(
              ne(Comment.moderationStatus, "APPROVED"),
              isNotNull(Comment.deletedAt),
            ),
          ),
        );
      return rows.map(mapCommentRow);
    },
    async attachPaths(comments) {
      if (comments.length === 0) return comments;
      const db = await getServerDb();
      const rows = await db
        .select({
          id: Comment.id,
          path: sql<string | null>`${Comment.path}::text`,
        })
        .from(Comment)
        .where(
          inArray(
            Comment.id,
            comments.map((comment) => comment.id),
          ),
        );
      const pathById = new Map(rows.map((row) => [row.id, row.path]));
      for (const comment of comments) {
        comment.path = pathById.get(comment.id) ?? null;
      }
      return comments;
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
          await tx.execute(sql`
            UPDATE "Comment" AS c
            SET "path" = p."path" || text2ltree(rezics_to_base36(nextval('post_path_label_seq')))
            FROM "Comment" AS p
            WHERE c."id" = ${created.id}::uuid
              AND p."id" = ${input.parentId}::uuid
          `);
          await tx
            .update(Comment)
            .set({
              replyCount: sql`${Comment.replyCount} + 1`,
              directReplyCount: sql`${Comment.directReplyCount} + 1`,
              lastReplyAt: now,
              updatedAt: now,
            })
            .where(eq(Comment.id, input.parentId));
        } else {
          await tx.execute(sql`
            UPDATE "Comment"
            SET "path" = text2ltree(rezics_to_base36(nextval('post_path_label_seq')))
            WHERE "id" = ${created.id}::uuid
          `);
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
          realmUnitId: Comment.realmUnitId,
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
          ...(input.realmUnitId !== undefined
            ? {
                // Clearing realmUnitId removes the comment from that realm only.
                realmUnitId: input.realmUnitId,
              }
            : {}),
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

function normalizeIds(ids: CommentListInput["ids"]): string[] | undefined {
  if (!ids) return undefined;
  if (Array.isArray(ids)) return ids;
  return ids
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

async function blockedAuthorIds(options?: {
  viewerUserId?: string | null;
}): Promise<string[]> {
  if (!options?.viewerUserId) return [];
  return blockService.blockedUserIds(options.viewerUserId);
}

function missingParentIds(
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

async function includeRedactedAncestors(
  repository: CommentRepository,
  comments: CommentWithRelations[],
): Promise<CommentWithRelations[]> {
  let parentIds = missingParentIds(comments);
  if (parentIds.length === 0) return comments;

  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  while (parentIds.length > 0) {
    const ancestors = await repository.findRedactedAncestors(parentIds);
    if (ancestors.length === 0) break;

    for (const ancestor of ancestors) {
      byId.set(ancestor.id, ancestor);
    }
    parentIds = missingParentIds([...byId.values()]);
  }

  return [...byId.values()];
}

function sortTreeComments(comments: CommentWithRelations[]) {
  return comments.sort((left, right) => {
    if (left.path && right.path && left.path !== right.path) {
      return left.path.localeCompare(right.path);
    }
    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

export class CommentService {
  constructor(
    private readonly repository: CommentRepository = createDrizzleCommentRepository(),
  ) {}

  async list(
    query: CommentListInput,
    options?: { viewerUserId?: string | null },
  ): Promise<{ comments: CommentWithRelations[]; total: number }> {
    const limit = Math.max(
      1,
      Math.min(Number(query.limit ?? DEFAULT_LIMIT), MAX_LIMIT),
    );
    const realmUnitId = query.realmUnitId ?? null;
    let ids = normalizeIds(query.ids);
    let parentCommentId: string | null | undefined;

    if (query.mode === "subtree" && query.subtreeRootCommentId) {
      const anchor = await this.repository.getSubtreeAnchor({
        id: query.subtreeRootCommentId,
        rootUnitId: query.rootUnitId,
        realmUnitId,
      });
      if (!anchor?.path) {
        throw new AppError(
          404,
          `Comment not found: ${query.subtreeRootCommentId}`,
        );
      }
      ids = await this.repository.listSubtreeDescendantIds({
        anchor: { id: anchor.id, depth: anchor.depth, path: anchor.path },
        rootUnitId: query.rootUnitId,
        realmUnitId,
        maxDepth: query.maxDepth,
      });
    } else if (query.mode !== "threaded") {
      parentCommentId = query.parentCommentId ?? null;
    }

    const blockedIds = await blockedAuthorIds(options);
    const listed = await this.repository.list({
      rootUnitId: query.rootUnitId,
      realmUnitId,
      authorUserId: query.authorUserId,
      state: query.state,
      ids,
      maxDepth: query.maxDepth,
      ...(parentCommentId !== undefined ? { parentCommentId } : {}),
      blockedAuthorIds: blockedIds,
      sort: query.sort,
      limit,
    });

    const listedComments = listed.comments;
    const isTreeRead = query.mode === "threaded" || query.mode === "subtree";
    const commentsWithAncestors = isTreeRead
      ? await includeRedactedAncestors(this.repository, listedComments)
      : listedComments;
    const pathComments = await this.repository.attachPaths(
      commentsWithAncestors,
    );
    if (commentsWithAncestors.length > listedComments.length) {
      sortTreeComments(pathComments);
    }

    return {
      comments: await this.repository.attachPinOverlays(pathComments),
      total: listed.total,
    };
  }

  async getById(id: string): Promise<CommentWithRelations> {
    const comment = await this.repository.getById(id);
    const withPaths = await this.repository.attachPaths([comment]);
    const withPins = await this.repository.attachPinOverlays([
      firstCommentOrThrow(withPaths, id),
    ]);
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
      if (
        parent.rootUnitId !== input.rootUnitId ||
        parent.realmUnitId !== (input.realmUnitId ?? null)
      ) {
        throw new AppError(
          400,
          "Parent comment is outside the requested root/realm partition",
        );
      }
      depth = parent.depth + 1;
    }

    const comment = await this.repository.create({
      rootUnitId: input.rootUnitId,
      realmUnitId: input.realmUnitId ?? null,
      parentCommentId: input.parentCommentId,
      authorUserId,
      content: input.content,
      depth,
      parentId: parent?.id,
    });

    await enqueueCommentSync(comment.id);
    const withPaths = await this.repository.attachPaths([comment]);
    return firstCommentOrThrow(withPaths, comment.id);
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
    const withPaths = await this.repository.attachPaths([updated]);
    return firstCommentOrThrow(withPaths, id);
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
