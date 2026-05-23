import type {
  CreatePostInput,
  RezicsSessionClaims,
  PostListQuery,
  UpdatePostInput,
} from "@rezics/contract";
import { parseIdsCsv } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import {
  type PostKind,
  PostKind as PostKindEnum,
  prisma,
  UnitStatus,
  UnitType,
} from "#/prisma/client";
import { patchPostFieldsToMeili, syncPostToMeili } from "@/meili/post/sync";
import {
  hydrateUnitOwnerUserSlugRow,
  hydrateUnitOwnerUserSlugs,
} from "@/utils/userSlugHydration";
import { publicUnitEligibilityWhere } from "@/unit/publication-policy";
import { resolveRezicsWikiUserId } from "@/infra/infra-users";
import {
  assertCanEditCollaborativeMetadata,
  writeEditorialMetadataHistory,
} from "@/unit/collaborative-metadata";
import type { PostWithRelations } from "./types";
import { postInclude } from "./types";
import { AppError } from "../utils/errors";

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
    const isThreaded = query.mode === "threaded";

    const where: Prisma.PostWhereInput = options?.isAdmin
      ? {}
      : isThreaded
        ? {
            OR: [
              { unit: { ...publicUnitEligibilityWhere } },
              {
                unit: {
                  status: UnitStatus.DELETED,
                  visibility: publicUnitEligibilityWhere.visibility,
                },
              },
            ],
          }
        : { unit: { ...publicUnitEligibilityWhere } };

    if (query.targetUnitId) where.targetUnitId = query.targetUnitId;
    if (query.rootPostUnitId) where.rootPostUnitId = query.rootPostUnitId;
    if (query.parentPostUnitId) where.parentPostUnitId = query.parentPostUnitId;
    if (query.authorUserId) where.authorUserId = query.authorUserId;
    if (query.kind) where.kind = query.kind;

    const idList = parseIdsCsv(query.ids);
    if (idList && idList.length > 0) {
      where.unitId = { in: idList };
    }

    if (query.subtreeRootPostUnitId) {
      const anchor = await prisma.post.findUniqueOrThrow({
        where: { unitId: query.subtreeRootPostUnitId },
        select: {
          unitId: true,
          rootPostUnitId: true,
          depth: true,
          sortPath: true,
        },
      });
      const rootPostUnitId = anchor.rootPostUnitId ?? anchor.unitId;
      where.rootPostUnitId = rootPostUnitId;
      where.unitId = { not: anchor.unitId };

      if (anchor.sortPath) {
        where.sortPath = { startsWith: `${anchor.sortPath}.` };
      } else if (rootPostUnitId !== anchor.unitId) {
        throw new AppError(
          400,
          "Cannot query a post subtree when the anchor post has no sortPath",
        );
      }

      if (typeof query.maxDepth === "number") {
        where.depth = { lte: anchor.depth + query.maxDepth };
      }
    } else if (typeof query.maxDepth === "number") {
      where.depth = { lte: query.maxDepth };
    }

    const orderBy: Prisma.PostOrderByWithRelationInput[] = isThreaded
      ? [{ sortPath: "asc" }, { createdAt: "asc" }]
      : [
          {
            createdAt:
              typeof query.sort === "object" &&
              (query.sort.order === "asc" || query.sort.order === "desc")
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

    return {
      posts: await hydrateUnitOwnerUserSlugs(posts as PostWithRelations[]),
      total,
    };
  }

  /** List posts associated with a realm through the RealmUnit junction. */
  async byRealm(
    realmUnitId: string,
    opts: Omit<PostListQuery, "realmUnitId" | "targetUnitId"> = {},
    options?: { isAdmin?: boolean },
  ): Promise<{ posts: PostWithRelations[]; total: number }> {
    const limitNum = Math.max(1, Math.min(Number(opts.limit ?? 50), 200));
    const skipNum = opts.start ?? 0;
    const sort = opts.sort === "top" || opts.sort === "hot" ? opts.sort : "new";
    const tagIds = this.normalizeTagIds(opts.tagIds);

    const where: Prisma.PostWhereInput = {
      unit: {
        ...(options?.isAdmin ? {} : publicUnitEligibilityWhere),
        inRealms: {
          some: { realmUnitId },
        },
        ...(tagIds.length > 0
          ? {
              OR: [
                {
                  realmTagApplicationsAsTargetUnit: {
                    some: {
                      realmUnitId,
                      tagUnitId: { in: tagIds },
                    },
                  },
                },
                {
                  AND: [
                    {
                      realmTagApplicationsAsTargetUnit: {
                        none: { realmUnitId },
                      },
                    },
                    {
                      unitTags: {
                        some: { tagUnitId: { in: tagIds } },
                      },
                    },
                  ],
                },
              ],
            }
          : {}),
      },
    };

    if (opts.rootPostUnitId) where.rootPostUnitId = opts.rootPostUnitId;
    if (opts.parentPostUnitId) where.parentPostUnitId = opts.parentPostUnitId;
    if (opts.authorUserId) where.authorUserId = opts.authorUserId;
    if (opts.kind) where.kind = opts.kind;

    if (typeof opts.maxDepth === "number") {
      where.depth = { lte: opts.maxDepth };
    }

    const idList = parseIdsCsv(opts.ids);
    if (idList && idList.length > 0) {
      where.unitId = { in: idList };
    }

    if (sort === "hot") {
      // Phase-1 approximation from design.md Decision 5: rank as top posts
      // within the last 7 days instead of the full decay formula.
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      where.createdAt = { gte: since };
    }

    const orderBy: Prisma.PostOrderByWithRelationInput[] =
      sort === "new"
        ? [{ createdAt: "desc" }]
        : [{ scoreEntry: { value: "desc" } }, { createdAt: "desc" }];

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

    return {
      posts: await hydrateUnitOwnerUserSlugs(posts as PostWithRelations[]),
      total,
    };
  }

  /** Get a single post by unit ID. */
  async getByUnitId(
    unitId: string,
    options?: { isAdmin?: boolean; allowTombstone?: boolean },
  ): Promise<PostWithRelations> {
    const post = await prisma.post.findUniqueOrThrow({
      where: { unitId },
      include: postInclude,
    });
    if (
      !options?.isAdmin &&
      !options?.allowTombstone &&
      (post.unit.status !== UnitStatus.PUBLISHED ||
        post.unit.visibility !== "PUBLIC")
    ) {
      throw new AppError(404, `Post not found: ${unitId}`);
    }
    return hydrateUnitOwnerUserSlugRow(post as PostWithRelations);
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
      realmUnitIds,
      tagIds,
      parentPostUnitId,
      kind,
      body,
      scoreEntryId,
      extra,
    } = input;
    const realmIdsToWrite = [...new Set(realmUnitIds ?? [])];
    const tagIdsToWrite = [...new Set(tagIds ?? [])];

    let targetUnitTypeFromChapterCheck: string | null = null;
    if (kind === PostKindEnum.CHAPTER) {
      if (!targetUnitId) {
        throw new Error(
          "Post(kind=CHAPTER) requires targetUnitId pointing to a Unit(type=BOOK)",
        );
      }
      const target = await prisma.unit.findUnique({
        where: { id: targetUnitId },
        select: { type: true },
      });
      if (!target || target.type !== UnitType.BOOK) {
        throw new Error(
          `Post(kind=CHAPTER) targetUnitId must reference a Unit(type=BOOK); got ${target?.type ?? "missing"}`,
        );
      }
      targetUnitTypeFromChapterCheck = target.type;
    }

    let depth = 0;
    let rootPostUnitId: string | undefined;
    let sortPath: string | undefined;
    let rootTargetUnitId: string | null = null;
    let rootTargetUnitType: string | null = null;

    if (parentPostUnitId) {
      const parent = await prisma.post.findUniqueOrThrow({
        where: { unitId: parentPostUnitId },
        select: {
          unitId: true,
          rootPostUnitId: true,
          depth: true,
          sortPath: true,
          isLocked: true,
          rootTargetUnitId: true,
          rootTargetUnitType: true,
        },
      });

      if (parent.isLocked) {
        throw new Error("Cannot reply to a locked post");
      }

      rootPostUnitId = parent.rootPostUnitId ?? parent.unitId;
      depth = parent.depth + 1;
      sortPath = await this.generateSortPath(parentPostUnitId);
      rootTargetUnitId = parent.rootTargetUnitId ?? null;
      rootTargetUnitType = parent.rootTargetUnitType ?? null;
    } else if (targetUnitId) {
      rootTargetUnitId = targetUnitId;
      if (targetUnitTypeFromChapterCheck) {
        rootTargetUnitType = targetUnitTypeFromChapterCheck;
      } else {
        const target = await prisma.unit.findUnique({
          where: { id: targetUnitId },
          select: { type: true },
        });
        rootTargetUnitType = target?.type ?? null;
      }
    }

    const post = await prisma.$transaction(async (tx) => {
      const ownerUserId =
        kind === "WIKI" ? await resolveRezicsWikiUserId() : authorUserId;
      const unit = await tx.unit.create({
        data: {
          userId: ownerUserId,
          slugScope: ownerUserId,
          type: UnitType.POST,
          status: UnitStatus.PUBLISHED,
        },
      });

      const createData: Prisma.PostUncheckedCreateInput = {
        unitId: unit.id,
        authorUserId,
        targetUnitId: targetUnitId ?? undefined,
        rootTargetUnitId: rootTargetUnitId ?? undefined,
        rootTargetUnitType: rootTargetUnitType ?? undefined,
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

      if (realmIdsToWrite.length > 0) {
        const createdAt = new Date();
        await Promise.all(
          realmIdsToWrite.map((realmUnitId) =>
            tx.realmUnit.create({
              data: {
                realmUnitId,
                unitId: created.unitId,
                createdAt,
              },
            }),
          ),
        );
      }

      if (tagIdsToWrite.length > 0) {
        const validTags = await tx.unit.findMany({
          where: {
            id: { in: tagIdsToWrite },
            type: UnitType.TAG,
            status: { not: UnitStatus.DELETED },
          },
          select: { id: true },
        });
        const validTagIds = new Set(validTags.map((tag) => tag.id));
        const invalidTagIds = tagIdsToWrite.filter(
          (id) => !validTagIds.has(id),
        );

        if (invalidTagIds.length > 0) {
          throw new AppError(
            400,
            `Invalid tagIds: ${invalidTagIds.join(", ")}`,
          );
        }

        await Promise.all(
          tagIdsToWrite.map((tagUnitId) =>
            tx.unitTag.create({
              data: {
                unitId: created.unitId,
                tagUnitId,
              },
            }),
          ),
        );
      }

      let result: PostWithRelations;

      // Top-level post: set rootPostUnitId to own unitId
      if (!parentPostUnitId) {
        const updated = await tx.post.update({
          where: { unitId: created.unitId },
          data: { rootPostUnitId: created.unitId },
          include: postInclude,
        });

        result = updated as PostWithRelations;
      } else {
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

        result = created as PostWithRelations;
      }

      if (kind === "WIKI") {
        await writeEditorialMetadataHistory(tx as any, {
          unitId: result.unitId,
          actorUserId: authorUserId,
          patch: { post: { body: result.body } },
          message: "wiki-post.create",
        });
      }

      return result;
    });

    // Fire-and-forget sync to Meilisearch
    syncPostToMeili(post.unitId).catch(() => {});

    return hydrateUnitOwnerUserSlugRow(post);
  }

  /** Update post body, isLocked, and/or extra. */
  async update(
    unitId: string,
    input: UpdatePostInput,
    actor?: RezicsSessionClaims,
  ): Promise<PostWithRelations> {
    const data: Prisma.PostUpdateInput = {};

    if (input.body !== undefined) data.body = input.body;
    if (input.isLocked !== undefined) data.isLocked = input.isLocked;
    if (input.extra !== undefined)
      data.extra = input.extra as Prisma.InputJsonValue;

    if (!actor) {
      const updated = await prisma.post.update({
        where: { unitId },
        data,
        include: postInclude,
      });

      const patchFields: Record<string, any> = {};
      if (input.body !== undefined) patchFields.body = input.body;
      if (input.isLocked !== undefined) patchFields.isLocked = input.isLocked;
      if (input.extra !== undefined) patchFields.extra = input.extra;
      patchPostFieldsToMeili(unitId, patchFields).catch(() => {});

      return hydrateUnitOwnerUserSlugRow(updated as PostWithRelations);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.post.findUniqueOrThrow({
        where: { unitId },
        select: { kind: true },
      });
      const isWikiBodyEdit =
        existing.kind === "WIKI" && input.body !== undefined;

      if (isWikiBodyEdit && actor) {
        await assertCanEditCollaborativeMetadata(tx as any, actor, unitId, [
          "post.body",
        ]);
      }

      const row = await tx.post.update({
        where: { unitId },
        data,
        include: postInclude,
      });

      if (isWikiBodyEdit && actor) {
        await writeEditorialMetadataHistory(tx as any, {
          unitId,
          actorUserId: actor.userId,
          patch: { post: { body: row.body } },
          message: "wiki-post.body.update",
        });
      }

      return row;
    });

    // Fire-and-forget partial sync to Meilisearch
    const patchFields: Record<string, any> = {};
    if (input.body !== undefined) patchFields.body = input.body;
    if (input.isLocked !== undefined) patchFields.isLocked = input.isLocked;
    if (input.extra !== undefined) patchFields.extra = input.extra;
    patchPostFieldsToMeili(unitId, patchFields).catch(() => {});

    return hydrateUnitOwnerUserSlugRow(updated as PostWithRelations);
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

  private normalizeTagIds(tagIds: unknown): string[] {
    if (!tagIds) return [];
    if (Array.isArray(tagIds)) return tagIds.filter(Boolean);
    if (typeof tagIds !== "string") return [];

    try {
      const parsed = JSON.parse(tagIds);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (value): value is string => typeof value === "string",
        );
      }
    } catch {
      // Fall back to comma-separated query values for hand-authored URLs.
    }

    return tagIds
      .split(",")
      .map((id: string) => id.trim())
      .filter(Boolean);
  }
}

export const postService = new PostService();
