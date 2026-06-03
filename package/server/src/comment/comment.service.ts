import type {
  CommentListBody,
  CommentListQuery,
  CreateCommentInput,
  UpdateCommentInput,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { Prisma, prisma } from "#/prisma/client";
import { blockService } from "@/block/block.service";
import { serverJobProducer } from "@/job/job-boundary";
import { AppError } from "@/utils/errors";
import { publicUserSelect } from "@/utils/sanitizeUser";
import type { CommentWithRelations } from "./comment.types";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
type CommentListInput = Omit<CommentListQuery, "ids"> & {
  ids?: CommentListQuery["ids"] | CommentListBody["ids"];
};

const commentInclude = {
  author: { select: publicUserSelect },
} as const;

// Public collections read only the serving snapshot; tree reads may add
// redacted ancestors after this filter to keep approved replies attached.
const publicCommentWhere = {
  moderationStatus: "APPROVED",
  deletedAt: null,
} as const satisfies Prisma.CommentWhereInput;

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

async function attachCommentPaths<
  T extends { id: string; path?: string | null },
>(comments: T[]): Promise<T[]> {
  if (comments.length === 0) return comments;
  const rows = await prisma.$queryRaw<{ id: string; path: string | null }[]>`
    SELECT "id", "path"::text AS path
    FROM "Comment"
    WHERE "id" IN (${Prisma.join(
      comments.map((comment) => Prisma.sql`${comment.id}::uuid`),
    )})
  `;
  const pathById = new Map(rows.map((row) => [row.id, row.path]));
  for (const comment of comments) {
    comment.path = pathById.get(comment.id) ?? null;
  }
  return comments;
}

async function attachPinOverlays<
  T extends {
    id: string;
    rootUnitId: string;
    pinKind?: string | null;
    pinPosition?: string | null;
  },
>(comments: T[]): Promise<T[]> {
  if (comments.length === 0) return comments;
  const rootUnitIds = [
    ...new Set(comments.map((comment) => comment.rootUnitId)),
  ];
  const pins = await prisma.commentPromotion.findMany({
    where: {
      scopeUnitId: { in: rootUnitIds },
      commentId: { in: comments.map((comment) => comment.id) },
    },
    select: {
      scopeUnitId: true,
      commentId: true,
      kind: true,
      position: true,
    },
  });
  const pinByScopeAndComment = new Map(
    pins.map((pin) => [
      `${pin.scopeUnitId}:${pin.commentId}`,
      { kind: pin.kind, position: pin.position },
    ]),
  );
  for (const comment of comments) {
    const pin = pinByScopeAndComment.get(`${comment.rootUnitId}:${comment.id}`);
    comment.pinKind = pin?.kind ?? null;
    comment.pinPosition = pin?.position ?? null;
  }
  return comments;
}

async function applyBlockedAuthorFilter(
  where: Prisma.CommentWhereInput,
  options?: { viewerUserId?: string | null },
) {
  if (!options?.viewerUserId) return;

  const blockedIds = await blockService.blockedUserIds(options.viewerUserId);
  if (blockedIds.length === 0) return;

  const existingAnd = where.AND
    ? Array.isArray(where.AND)
      ? where.AND
      : [where.AND]
    : [];
  where.AND = [...existingAnd, { authorUserId: { notIn: blockedIds } }];
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
  comments: CommentWithRelations[],
): Promise<CommentWithRelations[]> {
  let parentIds = missingParentIds(comments);
  if (parentIds.length === 0) return comments;

  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  while (parentIds.length > 0) {
    const ancestors = (await prisma.comment.findMany({
      where: {
        id: { in: parentIds },
        OR: [
          { moderationStatus: { not: "APPROVED" } },
          { deletedAt: { not: null } },
        ],
      },
      include: commentInclude,
    })) as CommentWithRelations[];

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
  async list(
    query: CommentListInput,
    options?: { viewerUserId?: string | null },
  ): Promise<{ comments: CommentWithRelations[]; total: number }> {
    const limit = Math.max(
      1,
      Math.min(Number(query.limit ?? DEFAULT_LIMIT), MAX_LIMIT),
    );
    const where: Prisma.CommentWhereInput = {
      rootUnitId: query.rootUnitId,
      realmUnitId: query.realmUnitId ?? null,
      ...publicCommentWhere,
    };

    if (query.authorUserId) where.authorUserId = query.authorUserId;
    if (query.state) where.state = query.state;
    const ids = normalizeIds(query.ids);
    if (ids?.length) where.id = { in: ids };
    if (typeof query.maxDepth === "number")
      where.depth = { lte: query.maxDepth };

    if (query.mode === "subtree" && query.subtreeRootCommentId) {
      const [anchor] = await prisma.$queryRaw<
        { id: string; depth: number; path: string | null }[]
      >`
        SELECT "id", "depth", "path"::text AS path
        FROM "Comment"
        WHERE "id" = ${query.subtreeRootCommentId}::uuid
          AND "rootUnitId" = ${query.rootUnitId}::uuid
          AND "realmUnitId" IS NOT DISTINCT FROM ${query.realmUnitId ?? null}::uuid
      `;
      if (!anchor?.path) {
        throw new AppError(
          404,
          `Comment not found: ${query.subtreeRootCommentId}`,
        );
      }
      const descendants = await prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Comment"
        WHERE "path" <@ ${anchor.path}::ltree
          AND "rootUnitId" = ${query.rootUnitId}::uuid
          AND "realmUnitId" IS NOT DISTINCT FROM ${query.realmUnitId ?? null}::uuid
          AND "id" <> ${anchor.id}::uuid
          ${
            typeof query.maxDepth === "number"
              ? Prisma.sql`AND "depth" <= ${anchor.depth + query.maxDepth}`
              : Prisma.empty
          }
      `;
      where.id = { in: descendants.map((row) => row.id) };
    } else if (query.mode !== "threaded") {
      where.parentCommentId = query.parentCommentId ?? null;
    }

    await applyBlockedAuthorFilter(where, options);

    const orderBy: Prisma.CommentOrderByWithRelationInput[] =
      query.sort === "top" || query.sort === "hot"
        ? [{ replyCount: "desc" }, { createdAt: "desc" }]
        : [{ createdAt: "asc" }];

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        orderBy,
        skip: 0,
        take: limit,
        include: commentInclude,
      }),
      prisma.comment.count({ where }),
    ]);

    const listedComments = comments as CommentWithRelations[];
    const isTreeRead = query.mode === "threaded" || query.mode === "subtree";
    const commentsWithAncestors = isTreeRead
      ? await includeRedactedAncestors(listedComments)
      : listedComments;
    const pathComments = await attachCommentPaths(commentsWithAncestors);
    if (commentsWithAncestors.length > listedComments.length) {
      sortTreeComments(pathComments);
    }

    return {
      comments: await attachPinOverlays(pathComments),
      total,
    };
  }

  async getById(id: string): Promise<CommentWithRelations> {
    const comment = await prisma.comment.findUniqueOrThrow({
      where: { id },
      include: commentInclude,
    });
    const withPaths = await attachCommentPaths([
      comment as CommentWithRelations,
    ]);
    const withPins = await attachPinOverlays([
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
      ? await prisma.comment.findUniqueOrThrow({
          where: { id: input.parentCommentId },
          select: {
            id: true,
            rootUnitId: true,
            realmUnitId: true,
            depth: true,
            isLocked: true,
          },
        })
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

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          rootUnitId: input.rootUnitId,
          realmUnitId: input.realmUnitId ?? null,
          parentCommentId: input.parentCommentId,
          authorUserId,
          content: input.content as Prisma.InputJsonValue,
          depth,
          moderationStatus: "APPROVED",
        },
        include: commentInclude,
      });

      if (parent) {
        await tx.$executeRaw`
          UPDATE "Comment" AS c
          SET "path" = p."path" || text2ltree(rezics_to_base36(nextval('post_path_label_seq')))
          FROM "Comment" AS p
          WHERE c."id" = ${created.id}::uuid
            AND p."id" = ${parent.id}::uuid
        `;
        await tx.comment.update({
          where: { id: parent.id },
          data: {
            replyCount: { increment: 1 },
            directReplyCount: { increment: 1 },
            lastReplyAt: new Date(),
          },
        });
      } else {
        await tx.$executeRaw`
          UPDATE "Comment"
          SET "path" = text2ltree(rezics_to_base36(nextval('post_path_label_seq')))
          WHERE "id" = ${created.id}::uuid
        `;
      }

      await tx.post.updateMany({
        where: { unitId: input.rootUnitId },
        data: {
          replyCount: { increment: 1 },
          ...(parent ? {} : { directReplyCount: { increment: 1 } }),
          lastReplyAt: new Date(),
        },
      });

      return created as CommentWithRelations;
    });

    await enqueueCommentSync(comment.id);
    const withPaths = await attachCommentPaths([comment]);
    return firstCommentOrThrow(withPaths, comment.id);
  }

  async update(
    id: string,
    input: UpdateCommentInput,
    actorUserId: string,
  ): Promise<CommentWithRelations> {
    const existing = await prisma.comment.findUniqueOrThrow({
      where: { id },
      select: { authorUserId: true, realmUnitId: true },
    });
    if (existing.authorUserId !== actorUserId) {
      throw new AppError(403, "Only the author can update this comment");
    }

    const updated = await prisma.comment.update({
      where: { id },
      data: {
        ...(input.content !== undefined
          ? { content: input.content as Prisma.InputJsonValue }
          : {}),
        ...(input.realmUnitId !== undefined
          ? {
              // Clearing realmUnitId removes the comment from that realm only.
              realmUnitId: input.realmUnitId,
            }
          : {}),
        ...(input.isLocked !== undefined ? { isLocked: input.isLocked } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
      },
      include: commentInclude,
    });
    await enqueueCommentSync(id);
    const withPaths = await attachCommentPaths([
      updated as CommentWithRelations,
    ]);
    return firstCommentOrThrow(withPaths, id);
  }

  async delete(id: string, actorUserId: string): Promise<void> {
    const existing = await prisma.comment.findUniqueOrThrow({
      where: { id },
      select: { authorUserId: true },
    });
    if (existing.authorUserId !== actorUserId) {
      throw new AppError(403, "Only the author can delete this comment");
    }
    await prisma.comment.update({
      where: { id },
      data: {
        content: Prisma.JsonNull,
        deletedAt: new Date(),
      },
    });
    await enqueueCommentSync(id);
  }
}

export const commentService = new CommentService();
