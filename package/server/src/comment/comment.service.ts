import {
  NotificationType,
  type CommentTreeNode,
  type CreateCommentInput,
  type UpdateCommentInput,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, UnitStatus, UnitType } from "#/prisma/client";
import { emitNotificationEvent } from "../notify/notify-client";
import { syncContentToMeili } from "@/meili/content/sync";
import { getCommentApproxCount } from "./sql";
import type { CommentWithRelations } from "./types";
import { commentInclude } from "./types";

export class CommentService {
  /**
   * Get a flat slice of comment tree under a root unit, optionally limited by parent (direct children)
   * - If parentId is provided, returns only direct children of that parent
   * - If parentId is omitted, returns all comments up to maxDepth from the root
   * - Results include public user info via Unit relation
   */
  async getCommentTreeFlat(
    rootUnitId: string,
    options: {
      parentId?: string;
      maxDepth?: number;
      start?: number;
      limit?: number;
      order?: "asc" | "desc";
    } = {},
  ): Promise<CommentTreeNode[]> {
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 50), 200));
    const skipNum = options.start ?? 0;
    const order = options.order ?? "asc";

    const where: Prisma.CommentIndexWhereInput = { rootUnitId };

    if (options.parentId) {
      // Only direct children of the given parent
      where.parentCommentId = options.parentId;
    } else if (typeof options.maxDepth === "number") {
      // Depth from root (0 = direct reply to root object)
      where.depth = { lte: options.maxDepth };
    }

    const items = await prisma.commentIndex.findMany({
      where,
      orderBy: [{ unit: { createdAt: order } }],
      skip: skipNum,
      take: limitNum,
      include: { unit: { include: { user: true } } },
    });

    return items.map((ci) => ({
      id: ci.unitId,
      rootUnitId: ci.rootUnitId,
      parentCommentId: ci.parentCommentId ?? undefined,
      depth: ci.depth,
      content: ci.unit?.content ?? undefined,
      createdAt: ci.unit?.createdAt,
      user: ci.unit?.user
        ? {
            unitId: ci.unit.user.unitId,
            slug: ci.unit.user.slug ?? undefined,
            name: ci.unit.user.name,
            avatar: ci.unit.user.avatar ?? (null as any),
            bio: ci.unit.user.bio ?? undefined,
          }
        : undefined,
    }));
  }

  /** List comments under a root unit, optionally restricted to a parent (direct children) */
  async list(
    rootUnitId: string,
    options: {
      parentId?: string;
      maxDepth?: number;
      start?: number;
      limit?: number;
      order?: "asc" | "desc";
    } = {},
  ) {
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 50), 200));
    const skipNum = options.start ?? 0;
    const order = options.order ?? "asc";

    const where: Prisma.CommentIndexWhereInput = { rootUnitId };

    if (options.parentId) {
      where.parentCommentId = options.parentId;
    } else if (typeof options.maxDepth === "number") {
      where.depth = { lte: options.maxDepth };
    }

    const [rows, _total] = await Promise.all([
      prisma.commentIndex.findMany({
        where,
        orderBy: [{ unit: { createdAt: order } }],
        skip: skipNum,
        take: limitNum,
        include: commentInclude,
      }),
      getCommentApproxCount(), // approximate total across all comments (not filtered)
    ]);

    return rows as CommentWithRelations[];
  }

  /** Get single comment by Unit id */
  async getByUnitId(unitId: string): Promise<CommentWithRelations> {
    const comment = await prisma.commentIndex.findUniqueOrThrow({
      where: { unitId },
      include: commentInclude,
    });
    return comment as CommentWithRelations;
  }

  /** Create a comment (Unit + CommentIndex) */
  async create(
    input: CreateCommentInput & { userId: string },
  ): Promise<CommentWithRelations> {
    const { rootPostId, parentCommentId, content, userId } = input;

    let depth = 0;
    if (parentCommentId) {
      const parent = await prisma.commentIndex.findUnique({
        where: { unitId: parentCommentId },
        select: { depth: true, rootUnitId: true },
      });
      if (!parent) throw new Error("Parent comment not found");
      if (parent.rootUnitId !== rootPostId)
        throw new Error("Parent comment belongs to a different root");
      depth = parent.depth + 1;
    }

    const created = await prisma.commentIndex.create({
      data: {
        unit: {
          create: {
            userId,
            type: UnitType.COMMENT,
            status: UnitStatus.ACTIVE,
            content,
          },
        },
        rootUnit: { connect: { id: rootPostId } },
        parentComment: parentCommentId
          ? { connect: { id: parentCommentId } }
          : undefined,
        depth,
      },
      include: commentInclude,
    });

    await syncContentToMeili(created.unitId);

    // Emit notification (fire-and-forget)
    prisma.unit
      .findUnique({
        where: { id: rootPostId },
        select: { userId: true, title: true },
      })
      .then((rootUnit) => {
        if (rootUnit && rootUnit.userId !== userId) {
          emitNotificationEvent({
            recipientId: rootUnit.userId,
            type: NotificationType.COMMENT,
            actorId: userId,
            entityType: "unit",
            entityId: rootPostId,
            meta: { entityTitle: rootUnit.title ?? undefined },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return created as CommentWithRelations;
  }

  /** Update comment content (only content mutable for now) */
  async update(
    unitId: string,
    input: UpdateCommentInput,
  ): Promise<CommentWithRelations> {
    const updated = await prisma.commentIndex.update({
      where: { unitId },
      data: {
        unit: { update: { content: input.content } },
      },
      include: commentInclude,
    });
    await syncContentToMeili(unitId);
    return updated as CommentWithRelations;
  }

  /** Delete comment */
  async delete(unitId: string): Promise<void> {
    const content = "This unit has been deleted ＞﹏＜";
    await prisma.commentIndex.update({
      where: { unitId },
      data: {
        unit: { update: { content } },
      },
      include: commentInclude,
    });
    await syncContentToMeili(unitId);
  }

  async exists(unitId: string): Promise<boolean> {
    const count = await prisma.commentIndex.count({ where: { unitId } });
    return count > 0;
  }
}

export const commentService = new CommentService();
