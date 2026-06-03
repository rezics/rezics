import type {
  CommentListQuery,
  CreateCommentInput,
  UpdateCommentInput,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { Prisma, prisma, UnitStatus, UnitType } from "#/prisma/client";
import { blockService } from "@/block/block.service";
import { serverJobProducer } from "@/job/job-boundary";
import { AppError } from "@/utils/errors";
import { publicUserSelect } from "@/utils/sanitizeUser";
import type { CommentWithRelations } from "./comment.types";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const commentInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      contentModerationState: true,
    },
  },
} as const;

function enqueueCommentSync(commentId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.commentSync,
      { commentId },
      { type: "server", service: "comment" },
    ),
  );
}

async function attachCommentPaths<
  T extends { unitId: string; path?: string | null },
>(comments: T[]): Promise<T[]> {
  if (comments.length === 0) return comments;
  const rows = await prisma.$queryRaw<
    { unitId: string; path: string | null }[]
  >`
    SELECT "unitId", "path"::text AS path
    FROM "Comment"
    WHERE "unitId" IN (${Prisma.join(
      comments.map((comment) => Prisma.sql`${comment.unitId}::uuid`),
    )})
  `;
  const pathByUnitId = new Map(rows.map((row) => [row.unitId, row.path]));
  for (const comment of comments) {
    comment.path = pathByUnitId.get(comment.unitId) ?? null;
  }
  return comments;
}

async function attachPinOverlays<
  T extends {
    unitId: string;
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
      commentUnitId: { in: comments.map((comment) => comment.unitId) },
    },
    select: {
      scopeUnitId: true,
      commentUnitId: true,
      kind: true,
      position: true,
    },
  });
  const pinByScopeAndComment = new Map(
    pins.map((pin) => [
      `${pin.scopeUnitId}:${pin.commentUnitId}`,
      { kind: pin.kind, position: pin.position },
    ]),
  );
  for (const comment of comments) {
    const pin = pinByScopeAndComment.get(
      `${comment.rootUnitId}:${comment.unitId}`,
    );
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

export class CommentService {
  async list(
    query: CommentListQuery,
    options?: { viewerUserId?: string | null },
  ): Promise<{ comments: CommentWithRelations[]; total: number }> {
    const limit = Math.max(
      1,
      Math.min(Number(query.limit ?? DEFAULT_LIMIT), MAX_LIMIT),
    );
    const where: Prisma.CommentWhereInput = {
      rootUnitId: query.rootUnitId,
      realmUnitId: query.realmUnitId,
      unit: {
        OR: [
          { status: UnitStatus.PUBLISHED, visibility: "PUBLIC" },
          { status: UnitStatus.DELETED, visibility: "PUBLIC" },
        ],
      },
    };

    if (query.authorUserId) where.authorUserId = query.authorUserId;
    if (query.state) where.state = query.state;
    if (typeof query.maxDepth === "number")
      where.depth = { lte: query.maxDepth };

    if (query.mode === "subtree" && query.subtreeRootCommentUnitId) {
      const [anchor] = await prisma.$queryRaw<
        { unitId: string; depth: number; path: string | null }[]
      >`
        SELECT "unitId", "depth", "path"::text AS path
        FROM "Comment"
        WHERE "unitId" = ${query.subtreeRootCommentUnitId}::uuid
          AND "rootUnitId" = ${query.rootUnitId}::uuid
          AND "realmUnitId" = ${query.realmUnitId}::uuid
      `;
      if (!anchor?.path) {
        throw new AppError(
          404,
          `Comment not found: ${query.subtreeRootCommentUnitId}`,
        );
      }
      const descendants = await prisma.$queryRaw<{ unitId: string }[]>`
        SELECT "unitId" FROM "Comment"
        WHERE "path" <@ ${anchor.path}::ltree
          AND "rootUnitId" = ${query.rootUnitId}::uuid
          AND "realmUnitId" = ${query.realmUnitId}::uuid
          AND "unitId" <> ${anchor.unitId}::uuid
          ${
            typeof query.maxDepth === "number"
              ? Prisma.sql`AND "depth" <= ${anchor.depth + query.maxDepth}`
              : Prisma.empty
          }
      `;
      where.unitId = { in: descendants.map((row) => row.unitId) };
    } else if (query.mode !== "threaded") {
      where.parentCommentUnitId = query.parentCommentUnitId ?? null;
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
        skip: query.start ?? 0,
        take: limit,
        include: commentInclude,
      }),
      prisma.comment.count({ where }),
    ]);

    return {
      comments: await attachPinOverlays(
        await attachCommentPaths(comments as CommentWithRelations[]),
      ),
      total,
    };
  }

  async getByUnitId(unitId: string): Promise<CommentWithRelations> {
    const comment = await prisma.comment.findUniqueOrThrow({
      where: { unitId },
      include: commentInclude,
    });
    const [withPath] = await attachCommentPaths([
      comment as CommentWithRelations,
    ]);
    const [withPins] = await attachPinOverlays([withPath]);
    return withPins;
  }

  async create(
    input: CreateCommentInput,
    authorUserId: string,
  ): Promise<CommentWithRelations> {
    let depth = 1;

    const parent = input.parentCommentUnitId
      ? await prisma.comment.findUniqueOrThrow({
          where: { unitId: input.parentCommentUnitId },
          select: {
            unitId: true,
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
        parent.realmUnitId !== input.realmUnitId
      ) {
        throw new AppError(
          400,
          "Parent comment is outside the requested root/realm partition",
        );
      }
      depth = parent.depth + 1;
    }

    const comment = await prisma.$transaction(async (tx) => {
      const unit = await tx.unit.create({
        data: {
          userId: authorUserId,
          slugScope: authorUserId,
          type: UnitType.COMMENT,
          status: UnitStatus.PUBLISHED,
          visibility: "PUBLIC",
          publishedAt: new Date(),
        },
      });

      const created = await tx.comment.create({
        data: {
          unitId: unit.id,
          rootUnitId: input.rootUnitId,
          realmUnitId: input.realmUnitId,
          parentCommentUnitId: input.parentCommentUnitId,
          authorUserId,
          content: input.content as Prisma.InputJsonValue,
          depth,
        },
        include: commentInclude,
      });

      if (parent) {
        await tx.$executeRaw`
          UPDATE "Comment" AS c
          SET "path" = p."path" || text2ltree(rezics_to_base36(nextval('post_path_label_seq')))
          FROM "Comment" AS p
          WHERE c."unitId" = ${created.unitId}::uuid
            AND p."unitId" = ${parent.unitId}::uuid
        `;
        await tx.comment.update({
          where: { unitId: parent.unitId },
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
          WHERE "unitId" = ${created.unitId}::uuid
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

    await enqueueCommentSync(comment.unitId);
    const [withPath] = await attachCommentPaths([comment]);
    return withPath;
  }

  async update(
    unitId: string,
    input: UpdateCommentInput,
    actorUserId: string,
  ): Promise<CommentWithRelations> {
    const existing = await prisma.comment.findUniqueOrThrow({
      where: { unitId },
      select: { authorUserId: true },
    });
    if (existing.authorUserId !== actorUserId) {
      throw new AppError(403, "Only the author can update this comment");
    }

    const updated = await prisma.comment.update({
      where: { unitId },
      data: {
        ...(input.content !== undefined
          ? { content: input.content as Prisma.InputJsonValue }
          : {}),
        ...(input.isLocked !== undefined ? { isLocked: input.isLocked } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
      },
      include: commentInclude,
    });
    await enqueueCommentSync(unitId);
    const [withPath] = await attachCommentPaths([
      updated as CommentWithRelations,
    ]);
    return withPath;
  }

  async delete(unitId: string, actorUserId: string): Promise<void> {
    const existing = await prisma.comment.findUniqueOrThrow({
      where: { unitId },
      select: { authorUserId: true },
    });
    if (existing.authorUserId !== actorUserId) {
      throw new AppError(403, "Only the author can delete this comment");
    }
    await prisma.comment.update({
      where: { unitId },
      data: {
        content: Prisma.JsonNull,
        unit: { update: { status: UnitStatus.DELETED } },
      },
    });
    await enqueueCommentSync(unitId);
  }
}

export const commentService = new CommentService();
