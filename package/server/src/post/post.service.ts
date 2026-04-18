import type {
  CreatePostInput,
  PostListQuery,
  UpdatePostInput,
} from "@rezics/contract";
import { parseIdsCsv } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { type PostKind, prisma, UnitStatus, UnitType } from "#/prisma/client";
import { patchPostFieldsToMeili, syncPostToMeili } from "@/meili/post/sync";
import type { PostWithRelations } from "./types";
import { postInclude } from "./types";

export class PostService {
  /**
   * List posts with support for flat and threaded modes.
   *
   * - flat mode (default): ordered by createdAt, sortPath is null
   * - threaded mode (mode="threaded"): ordered by sortPath for tree display
   */
  async list(
    query: PostListQuery = {},
    options?: { isAdmin?: boolean },
  ): Promise<{ posts: PostWithRelations[]; total: number }> {
    const limitNum = Math.max(1, Math.min(Number(query.limit ?? 50), 200));
    const skipNum = query.start ?? 0;

    const where: Prisma.PostWhereInput = options?.isAdmin
      ? {}
      : { unit: { status: UnitStatus.PUBLISHED } };

    if (query.targetUnitId) where.targetUnitId = query.targetUnitId;
    if (query.realmUnitId) where.realmUnitId = query.realmUnitId;
    if (query.rootPostUnitId) where.rootPostUnitId = query.rootPostUnitId;
    if (query.parentPostUnitId) where.parentPostUnitId = query.parentPostUnitId;
    if (query.authorUserId) where.authorUserId = query.authorUserId;
    if (query.kind) where.kind = query.kind;

    if (typeof query.maxDepth === "number") {
      where.depth = { lte: query.maxDepth };
    }

    const idList = parseIdsCsv(query.ids);
    if (idList && idList.length > 0) {
      where.unitId = { in: idList };
    }

    const isThreaded = query.mode === "threaded";

    const orderBy: Prisma.PostOrderByWithRelationInput[] = isThreaded
      ? [{ sortPath: "asc" }, { createdAt: "asc" }]
      : [
          {
            createdAt:
              query.sort?.order === "asc" || query.sort?.order === "desc"
                ? query.sort.order
                : "desc",
          },
        ];

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy,
        skip: skipNum,
        take: limitNum,
        include: postInclude,
      }),
      prisma.post.count({ where }),
    ]);

    return { posts: posts as PostWithRelations[], total };
  }

  /** Get a single post by unit ID. */
  async getByUnitId(unitId: string): Promise<PostWithRelations> {
    const post = await prisma.post.findUniqueOrThrow({
      where: { unitId },
      include: postInclude,
    });
    return post as PostWithRelations;
  }

  /**
   * Create a post with tree handling.
   *
   * Top-level post: rootPostUnitId = own unitId, depth = 0.
   * Reply: inherits root from parent, depth = parent.depth + 1,
   *        sortPath generated for threaded mode.
   */
  async create(
    input: CreatePostInput,
    authorUserId: string,
  ): Promise<PostWithRelations> {
    const {
      targetUnitId,
      realmUnitId,
      parentPostUnitId,
      kind,
      body,
      scoreEntryId,
      extra,
    } = input;

    let depth = 0;
    let rootPostUnitId: string | undefined;
    let sortPath: string | undefined;

    if (parentPostUnitId) {
      const parent = await prisma.post.findUniqueOrThrow({
        where: { unitId: parentPostUnitId },
        select: {
          unitId: true,
          rootPostUnitId: true,
          depth: true,
          sortPath: true,
          isLocked: true,
        },
      });

      if (parent.isLocked) {
        throw new Error("Cannot reply to a locked post");
      }

      rootPostUnitId = parent.rootPostUnitId ?? parent.unitId;
      depth = parent.depth + 1;
      sortPath = await this.generateSortPath(parentPostUnitId);
    }

    const post = await prisma.$transaction(async (tx) => {
      const unit = await tx.unit.create({
        data: {
          userId: authorUserId,
          type: UnitType.POST,
          status: UnitStatus.PUBLISHED,
        },
      });

      const createData: Prisma.PostUncheckedCreateInput = {
        unitId: unit.id,
        authorUserId,
        targetUnitId: targetUnitId ?? undefined,
        realmUnitId: realmUnitId ?? undefined,
        body,
        kind: (kind as PostKind) ?? undefined,
        scoreEntryId: scoreEntryId ?? undefined,
        depth,
        sortPath: sortPath ?? undefined,
        extra: extra as Prisma.InputJsonValue | undefined,
        rootPostUnitId: rootPostUnitId ?? undefined,
        parentPostUnitId: parentPostUnitId ?? undefined,
      };

      const created = await tx.post.create({
        data: createData,
        include: postInclude,
      });

      // Top-level post: set rootPostUnitId to own unitId
      if (!parentPostUnitId) {
        const updated = await tx.post.update({
          where: { unitId: created.unitId },
          data: { rootPostUnitId: created.unitId },
          include: postInclude,
        });

        return updated as PostWithRelations;
      }

      // Reply: increment parent counters and update lastReplyAt
      await tx.post.update({
        where: { unitId: parentPostUnitId },
        data: {
          replyCount: { increment: 1 },
          directReplyCount: { increment: 1 },
          lastReplyAt: new Date(),
        },
      });

      // Also increment root post's replyCount (not directReplyCount)
      if (rootPostUnitId && rootPostUnitId !== parentPostUnitId) {
        await tx.post.update({
          where: { unitId: rootPostUnitId },
          data: {
            replyCount: { increment: 1 },
            lastReplyAt: new Date(),
          },
        });
      }

      return created as PostWithRelations;
    });

    // Fire-and-forget sync to Meilisearch
    syncPostToMeili(post.unitId).catch(() => {});

    return post;
  }

  /** Update post body, isLocked, and/or extra. */
  async update(
    unitId: string,
    input: UpdatePostInput,
  ): Promise<PostWithRelations> {
    const data: Prisma.PostUpdateInput = {};

    if (input.body !== undefined) data.body = input.body;
    if (input.isLocked !== undefined) data.isLocked = input.isLocked;
    if (input.extra !== undefined)
      data.extra = input.extra as Prisma.InputJsonValue;

    const updated = await prisma.post.update({
      where: { unitId },
      data,
      include: postInclude,
    });

    // Fire-and-forget partial sync to Meilisearch
    const patchFields: Record<string, any> = {};
    if (input.body !== undefined) patchFields.body = input.body;
    if (input.isLocked !== undefined) patchFields.isLocked = input.isLocked;
    if (input.extra !== undefined) patchFields.extra = input.extra;
    patchPostFieldsToMeili(unitId, patchFields).catch(() => {});

    return updated as PostWithRelations;
  }

  /** Delete a post and decrement parent reply counts. */
  async delete(unitId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const post = await tx.post.findUniqueOrThrow({
        where: { unitId },
        select: {
          parentPostUnitId: true,
          rootPostUnitId: true,
        },
      });

      // Soft-delete: mark the unit as DELETED
      await tx.unit.update({
        where: { id: unitId },
        data: { status: UnitStatus.DELETED },
      });

      // Clear the post body
      await tx.post.update({
        where: { unitId },
        data: { body: null },
      });

      // Decrement parent counters
      if (post.parentPostUnitId) {
        await tx.post.update({
          where: { unitId: post.parentPostUnitId },
          data: {
            replyCount: { decrement: 1 },
            directReplyCount: { decrement: 1 },
          },
        });
      }

      // Decrement root post replyCount (not directReplyCount)
      if (
        post.rootPostUnitId &&
        post.rootPostUnitId !== unitId &&
        post.rootPostUnitId !== post.parentPostUnitId
      ) {
        await tx.post.update({
          where: { unitId: post.rootPostUnitId },
          data: {
            replyCount: { decrement: 1 },
          },
        });
      }
    });

    // Fire-and-forget sync to Meilisearch (will remove the deleted post)
    syncPostToMeili(unitId).catch(() => {});
  }

  /**
   * Generate a sortPath for a new reply under the given parent.
   *
   * sortPath format: zero-padded 4-digit segments separated by dots.
   * Example: "0001.0003.0001"
   *
   * Queries the maximum sibling sortPath under the parent, increments,
   * and appends to the parent's sortPath.
   */
  private async generateSortPath(parentPostUnitId: string): Promise<string> {
    const parent = await prisma.post.findUniqueOrThrow({
      where: { unitId: parentPostUnitId },
      select: { sortPath: true },
    });

    const parentPath = parent.sortPath ?? "";

    // Find the max sortPath among direct children of this parent
    const lastSibling = await prisma.post.findFirst({
      where: { parentPostUnitId },
      orderBy: { sortPath: "desc" },
      select: { sortPath: true },
    });

    let nextSegment = 1;

    if (lastSibling?.sortPath) {
      // Extract the last segment from the sibling's sortPath
      const segments = lastSibling.sortPath.split(".");
      const lastSegment = segments[segments.length - 1] ?? "0";
      const parsed = parseInt(lastSegment, 10);
      if (!isNaN(parsed)) {
        nextSegment = parsed + 1;
      }
    }

    const paddedSegment = String(nextSegment).padStart(4, "0");

    return parentPath ? `${parentPath}.${paddedSegment}` : paddedSegment;
  }
}

export const postService = new PostService();
