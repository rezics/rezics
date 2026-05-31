import type {
  AcceptAnswerInput,
  CreatePostInput,
  EditorialPatchSubmission,
  PinPostInput,
  PostListQuery,
  PostPinDTO,
  RezicsSessionClaims,
  UpdatePostInput,
} from "@rezics/contract";
import {
  allBucketSlugs,
  BasicAdminPermission,
  DEFAULT_LANGUAGE,
  getStateSchema,
  isLegalStateValue,
  isLegalTransition,
  isStatefulTagSlug,
  mainMarkdownSource,
  normalizeStateSlug,
  OFFICIAL_QUESTION_TAG_SLUG,
  parseIdsCsv,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import {
  PinKind as PinKindEnum,
  type PostKind,
  PostKind as PostKindEnum,
  Prisma,
  prisma,
  UnitStatus,
  UnitType,
} from "#/prisma/client";
import { blockService } from "@/block/block.service";
import { commentService } from "@/comment/comment.service";
import type { CommentWithRelations } from "@/comment/comment.types";
import { resolveRezicsWikiUserId } from "@/infra/infra-users";
import { generateBetween } from "@/shelf/fractional-index";
import { serverJobProducer } from "@/job/job-boundary";
import {
  assertCanEditCollaborativeMetadata,
  collectPatchLeafPaths,
  writeEditorialMetadataHistory,
} from "@/unit/collaborative-metadata";
import { publicUnitEligibilityWhere } from "@/unit/publication-policy";
import {
  hydrateUnitOwnerUserSlugRow,
  hydrateUnitOwnerUserSlugs,
} from "@/utils/userSlugHydration";
import { publicUserSelect } from "@/utils/sanitizeUser";
import { AppError } from "../utils/errors";
import { mapPostPinToDTO } from "./post.mapper";
import type { PostWithRelations } from "./types";
import { postInclude } from "./types";

function enqueuePostSync(unitId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.postSync,
      { postId: unitId },
      { type: "server", service: "post" },
    ),
  );
}

function enqueueContentSync(unitId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.contentSync,
      { unitId },
      { type: "server", service: "post" },
    ),
  );
}

function enqueuePostFields(unitId: string, fields: Record<string, unknown>) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.postPatchFields,
      { targetId: unitId, fields },
      { type: "server", service: "post" },
    ),
  );
}

function commentAsPostCompat(comment: any): PostWithRelations {
  return {
    unitId: comment.unitId,
    authorUserId: comment.authorUserId,
    targetUnitId: comment.rootUnitId,
    realmUnitId: comment.realmUnitId,
    scoreEntryId: null,
    content: comment.content,
    rootPostUnitId: comment.rootUnitId,
    parentPostUnitId: comment.parentCommentUnitId ?? comment.rootUnitId,
    kind: null,
    depth: comment.depth,
    path: comment.path ?? null,
    replyCount: comment.replyCount,
    directReplyCount: comment.directReplyCount,
    lastReplyAt: comment.lastReplyAt,
    isLocked: comment.isLocked,
    state: comment.state,
    extra: null,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    unit: {
      ...comment.unit,
      licenseSlug: comment.unit?.licenseSlug ?? null,
    },
    pinKind: null,
    pinPosition: null,
  } as PostWithRelations;
}

const commentIncludeForPostCompat = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      contentModerationState: true,
    },
  },
} as const;

async function attachCommentPathsForPostCompat<
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

function readRealmRuleUnitId(extra: Prisma.JsonValue | null): string | null {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return null;
  const rule = (extra as Record<string, unknown>).rule;
  return typeof rule === "string" && rule.length > 0 ? rule : null;
}

/** Read the snapshotted governing-schema tag slug from a post's `extra`. */
function readStateSchemaTag(extra: Prisma.JsonValue | null): string | null {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return null;
  const tag = (extra as Record<string, unknown>).stateSchemaTag;
  return typeof tag === "string" && tag.length > 0 ? tag : null;
}

/**
 * Apply the lifecycle `state` filter to a post query: an exact `state` match,
 * or a derived bucket (`active`/`closed`) expanded to its slug set across the
 * registered schemas. A cheap indexed `IN`-list — never an anti-join. `state`
 * is a presentation label and gates nothing; this is filtering only.
 */
function applyStateFilter(
  where: Prisma.PostWhereInput,
  query: { state?: string; stateBucket?: "active" | "closed" },
) {
  if (query.state) {
    where.state = query.state;
  } else if (query.stateBucket) {
    where.state = { in: allBucketSlugs(query.stateBucket) };
  }
}

const REALM_FEED_EXCLUDED_MODERATION_STATES = [
  "HIDDEN",
  "TOMBSTONED",
  "ARCHIVED",
  "REMOVED",
] as const;

const REALM_REPLY_BLOCKING_MODERATION_STATES = [
  "HIDDEN",
  "TOMBSTONED",
  "LOCKED",
  "ARCHIVED",
  "REMOVED",
] as const;

function wikiContentTranslationStatus(isDraft: boolean) {
  return isDraft ? "DRAFT" : "PUBLISHED";
}

async function upsertWikiContentTranslation(
  tx: Prisma.TransactionClient,
  input: {
    unitId: string;
    language: string;
    content: unknown;
    actorUserId: string;
    status: "DRAFT" | "PUBLISHED";
  },
) {
  await tx.contentTranslation.upsert({
    where: {
      unitId_language: {
        unitId: input.unitId,
        language: input.language,
      },
    },
    create: {
      unitId: input.unitId,
      language: input.language,
      content: input.content as Prisma.InputJsonValue,
      status: input.status,
      authorUserId: input.actorUserId,
      provenance: { source: "legacy-post-content" },
    },
    update: {
      content: input.content as Prisma.InputJsonValue,
      status: input.status,
      authorUserId: input.actorUserId,
      provenance: { source: "legacy-post-content" },
    },
  });
}

/** Realm roles that may pin/accept within a realm's threads. */
const PROMOTION_ROLES = ["owner", "admin", "moderator"] as const;

function realmLifecycleStateFilter(
  state: PostListQuery["realmLifecycleState"],
) {
  if (!state || state === "all") return undefined;
  return state.toUpperCase();
}

async function applyBlockedAuthorFilter(
  where: Prisma.PostWhereInput,
  options?: { isAdmin?: boolean; viewerUserId?: string | null },
) {
  if (options?.isAdmin || !options?.viewerUserId) return;

  const blockedIds = await blockService.blockedUserIds(options.viewerUserId);
  if (blockedIds.length === 0) return;

  const existingAnd = where.AND
    ? Array.isArray(where.AND)
      ? where.AND
      : [where.AND]
    : [];
  where.AND = [...existingAnd, { authorUserId: { notIn: blockedIds } }];
}

/**
 * Attach the `Unsupported("ltree")` `path` column to post rows. Prisma's typed
 * client cannot project `path`, so we read it in one indexed lookup keyed by
 * `unitId` and merge it onto the rows (null when a row has no path yet). The
 * value is the materialized path text (e.g. `"1.3.a"`) used by the client to
 * compute tree structure; it is never a presentation-order key (School B).
 */
async function attachPostPaths<
  T extends { unitId: string; path?: string | null },
>(posts: T[]): Promise<T[]> {
  if (posts.length === 0) return posts;
  const rows = await prisma.$queryRaw<
    { unitId: string; path: string | null }[]
  >`
    SELECT "unitId", "path"::text AS path
    FROM "Post"
    WHERE "unitId" IN (${Prisma.join(
      posts.map((post) => Prisma.sql`${post.unitId}::uuid`),
    )})
  `;
  const pathByUnitId = new Map(rows.map((row) => [row.unitId, row.path]));
  for (const post of posts) {
    post.path = pathByUnitId.get(post.unitId) ?? null;
  }
  return posts;
}

/**
 * Attach the promotion overlay (`pinKind`/`pinPosition`) to thread rows. A post
 * is promoted at most once per scope and its scope is always its own thread
 * root, so `postUnitId` maps to at most one `PostPin` — we can key the lookup by
 * `postUnitId` directly. Ordinary replies stay `null`.
 */
async function attachPinKinds<
  T extends {
    unitId: string;
    pinKind?: PinKindEnum | null;
    pinPosition?: string | null;
  },
>(posts: T[]): Promise<T[]> {
  if (posts.length === 0) return posts;
  const pins = await prisma.postPin.findMany({
    where: { postUnitId: { in: posts.map((post) => post.unitId) } },
    select: { postUnitId: true, kind: true, position: true },
  });
  const pinByPostUnitId = new Map(pins.map((pin) => [pin.postUnitId, pin]));
  for (const post of posts) {
    const pin = pinByPostUnitId.get(post.unitId);
    post.pinKind = pin?.kind ?? null;
    post.pinPosition = pin?.position ?? null;
  }
  return posts;
}

export class PostService {
  private isCommentRead(query: PostListQuery) {
    return Boolean(query.rootPostUnitId || query.parentPostUnitId);
  }

  private async resolveCommentRealmIds(
    rootUnitId: string,
    explicitRealmUnitId?: string,
  ): Promise<string[]> {
    if (explicitRealmUnitId) return [explicitRealmUnitId];
    const rows = await prisma.unitRealm.findMany({
      where: { unitId: rootUnitId, state: "VISIBLE" },
      select: { realmUnitId: true },
    });
    return rows.map((row) => row.realmUnitId);
  }

  private async listCommentCompat(
    query: PostListQuery,
    options?: { isAdmin?: boolean; viewerUserId?: string | null },
  ): Promise<{ posts: PostWithRelations[]; total: number }> {
    const limitNum = Math.max(1, Math.min(Number(query.limit ?? 50), 200));
    const skipNum = query.start ?? 0;
    const idList = parseIdsCsv(query.ids);

    const parentComment = query.parentPostUnitId
      ? await prisma.comment.findUnique({
          where: { unitId: query.parentPostUnitId },
          select: { unitId: true, rootUnitId: true, realmUnitId: true },
        })
      : null;

    const parentPost =
      query.parentPostUnitId && !parentComment
        ? await prisma.post.findUnique({
            where: { unitId: query.parentPostUnitId },
            select: { unitId: true, rootPostUnitId: true },
          })
        : null;

    const rootUnitId =
      query.rootPostUnitId ??
      parentComment?.rootUnitId ??
      parentPost?.rootPostUnitId ??
      parentPost?.unitId;

    if (!rootUnitId) {
      throw new AppError(400, "Comment reads require a root or parent unit");
    }

    const realmUnitIds = parentComment
      ? [parentComment.realmUnitId]
      : await this.resolveCommentRealmIds(rootUnitId, query.realmUnitId);

    if (realmUnitIds.length === 0) {
      return { posts: [], total: 0 };
    }

    const where: Prisma.CommentWhereInput = {
      rootUnitId,
      realmUnitId:
        realmUnitIds.length === 1 ? realmUnitIds[0] : { in: realmUnitIds },
      unit: options?.isAdmin
        ? undefined
        : {
            OR: [
              { status: UnitStatus.PUBLISHED, visibility: "PUBLIC" },
              { status: UnitStatus.DELETED, visibility: "PUBLIC" },
            ],
          },
    };

    if (query.authorUserId) where.authorUserId = query.authorUserId;
    if (query.state) where.state = query.state;
    if (typeof query.maxDepth === "number") {
      where.depth = { lte: query.maxDepth };
    }

    if (query.subtreeRootPostUnitId) {
      const [anchor] = await prisma.$queryRaw<
        {
          unitId: string;
          rootUnitId: string;
          depth: number;
          path: string | null;
        }[]
      >`
        SELECT "unitId", "rootUnitId", "depth", "path"::text AS path
        FROM "Comment"
        WHERE "unitId" = ${query.subtreeRootPostUnitId}::uuid
          AND "rootUnitId" = ${rootUnitId}::uuid
      `;
      if (!anchor?.path) {
        throw new AppError(
          404,
          `Comment not found: ${query.subtreeRootPostUnitId}`,
        );
      }
      const maxDepth =
        typeof query.maxDepth === "number" ? query.maxDepth : undefined;
      const descendants = await prisma.$queryRaw<{ unitId: string }[]>`
        SELECT "unitId" FROM "Comment"
        WHERE "path" <@ ${anchor.path}::ltree
          AND "rootUnitId" = ${rootUnitId}::uuid
          AND "unitId" <> ${anchor.unitId}::uuid
          ${
            maxDepth !== undefined
              ? Prisma.sql`AND "depth" <= ${anchor.depth + maxDepth}`
              : Prisma.empty
          }
      `;
      const descendantIds = descendants.map((row) => row.unitId);
      where.unitId =
        idList && idList.length > 0
          ? { in: descendantIds.filter((id) => idList.includes(id)) }
          : { in: descendantIds };
    } else if (query.parentPostUnitId) {
      where.parentCommentUnitId = parentComment ? parentComment.unitId : null;
    } else if (idList && idList.length > 0) {
      where.unitId = { in: idList };
    }

    await applyBlockedAuthorFilter(where, options);

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        orderBy: [{ createdAt: "asc" }],
        skip: skipNum,
        take: limitNum,
        include: commentIncludeForPostCompat,
      }),
      prisma.comment.count({ where }),
    ]);

    const compatPosts = await attachPinKinds(
      (
        await attachCommentPathsForPostCompat(
          comments as CommentWithRelations[],
        )
      ).map(commentAsPostCompat),
    );

    return {
      posts: await hydrateUnitOwnerUserSlugs(compatPosts),
      total,
    };
  }

  /**
   * List posts with support for flat and threaded modes.
   *
   * - flat mode (default): ordered by `createdAt`
   * - threaded mode (mode="threaded"): the subtree is bounded by
   *   `rootPostUnitId` (whole thread) or `path <@ anchor.path`
   *   (continue-thread anchor) and ordered by a DB key (`createdAt`); the
   *   client groups rows into a tree (School B — `path` does not encode order).
   */
  async list(
    query: PostListQuery = {},
    options?: { isAdmin?: boolean; viewerUserId?: string | null },
  ): Promise<{ posts: PostWithRelations[]; total: number }> {
    if (this.isCommentRead(query)) {
      return this.listCommentCompat(query, options);
    }

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

    if (query.targetUnitId) {
      where.targetUnitId = query.targetUnitId;
      if (!query.rootPostUnitId && !query.parentPostUnitId && !isThreaded) {
        where.parentPostUnitId = null;
      }
    }
    if (
      !query.targetUnitId &&
      !query.rootPostUnitId &&
      !query.parentPostUnitId &&
      !query.subtreeRootPostUnitId &&
      !isThreaded
    ) {
      where.parentPostUnitId = null;
    }
    if (query.rootPostUnitId) where.rootPostUnitId = query.rootPostUnitId;
    if (query.parentPostUnitId) where.parentPostUnitId = query.parentPostUnitId;
    if (query.authorUserId) where.authorUserId = query.authorUserId;
    if (query.kind) where.kind = query.kind;
    applyStateFilter(where, query);

    const idList = parseIdsCsv(query.ids);
    if (idList && idList.length > 0) {
      where.unitId = { in: idList };
    }

    await applyBlockedAuthorFilter(where, options);

    if (query.subtreeRootPostUnitId) {
      const [anchor] = await prisma.$queryRaw<
        {
          unitId: string;
          rootPostUnitId: string | null;
          depth: number;
          path: string | null;
        }[]
      >`
        SELECT "unitId", "rootPostUnitId", "depth", "path"::text AS path
        FROM "Post"
        WHERE "unitId" = ${query.subtreeRootPostUnitId}::uuid
      `;
      if (!anchor) {
        throw new AppError(
          404,
          `Post not found: ${query.subtreeRootPostUnitId}`,
        );
      }
      const rootPostUnitId = anchor.rootPostUnitId ?? anchor.unitId;
      where.rootPostUnitId = rootPostUnitId;

      const maxDepth =
        typeof query.maxDepth === "number" ? query.maxDepth : undefined;
      // Partial-subtree retrieval over the GiST index: descendants of the
      // anchor, scoped to the same thread and (optionally) depth-bounded. The
      // anchor itself is excluded.
      const descendants = await prisma.$queryRaw<{ unitId: string }[]>`
        SELECT "unitId" FROM "Post"
        WHERE "path" <@ ${anchor.path}::ltree
          AND "rootPostUnitId" = ${rootPostUnitId}::uuid
          AND "unitId" <> ${anchor.unitId}::uuid
          ${
            maxDepth !== undefined
              ? Prisma.sql`AND "depth" <= ${anchor.depth + maxDepth}`
              : Prisma.empty
          }
      `;
      const descendantIds = descendants.map((row) => row.unitId);
      where.unitId =
        idList && idList.length > 0
          ? { in: descendantIds.filter((id) => idList.includes(id)) }
          : { in: descendantIds };
    } else if (typeof query.maxDepth === "number") {
      where.depth = { lte: query.maxDepth };
    }

    const orderBy: Prisma.PostOrderByWithRelationInput[] = isThreaded
      ? [{ createdAt: "asc" }]
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
      posts: await hydrateUnitOwnerUserSlugs(
        await attachPinKinds(
          await attachPostPaths(posts as PostWithRelations[]),
        ),
      ),
      total,
    };
  }

  /** List posts associated with a realm through the UnitRealm junction. */
  async byRealm(
    realmUnitId: string,
    opts: Omit<PostListQuery, "realmUnitId" | "targetUnitId"> = {},
    options?: { isAdmin?: boolean; viewerUserId?: string | null },
  ): Promise<{ posts: PostWithRelations[]; total: number }> {
    const limitNum = Math.max(1, Math.min(Number(opts.limit ?? 50), 200));
    const skipNum = opts.start ?? 0;
    const sort = opts.sort === "top" || opts.sort === "hot" ? opts.sort : "new";
    const tagIds = this.normalizeTagIds(opts.tagIds);
    const lifecycleState = realmLifecycleStateFilter(opts.realmLifecycleState);

    if (!(await this.canReadRealmFeed(realmUnitId, options))) {
      return { posts: [], total: 0 };
    }

    const where: Prisma.PostWhereInput = {
      unit: {
        ...(options?.isAdmin ? {} : publicUnitEligibilityWhere),
        inRealms: {
          some: {
            realmUnitId,
            ...(options?.isAdmin
              ? lifecycleState && lifecycleState === "VISIBLE"
                ? { state: lifecycleState as any }
                : {}
              : { state: "VISIBLE" as const }),
          },
        },
        ...(options?.isAdmin && lifecycleState && lifecycleState !== "VISIBLE"
          ? {
              realmModerationTargets: {
                some: {
                  realmUnitId,
                  state: lifecycleState as any,
                },
              },
            }
          : options?.isAdmin
            ? {}
            : {
                realmModerationTargets: {
                  none: {
                    realmUnitId,
                    state: {
                      in: REALM_FEED_EXCLUDED_MODERATION_STATES as any,
                    },
                  },
                },
              }),
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
    if (!opts.rootPostUnitId && !opts.parentPostUnitId) {
      where.parentPostUnitId = null;
    }
    if (opts.authorUserId) where.authorUserId = opts.authorUserId;
    if (opts.kind) where.kind = opts.kind;
    applyStateFilter(where, opts);

    await applyBlockedAuthorFilter(where, options);

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
      posts: await hydrateUnitOwnerUserSlugs(
        await attachPinKinds(
          await attachPostPaths(posts as PostWithRelations[]),
        ),
      ),
      total,
    };
  }

  private async canReadRealmFeed(
    realmUnitId: string,
    options?: { isAdmin?: boolean; viewerUserId?: string | null },
  ): Promise<boolean> {
    if (options?.isAdmin) return true;

    const realm = await prisma.realm.findUnique({
      where: { unitId: realmUnitId },
      select: {
        isPublic: true,
        unit: { select: { userId: true } },
        members: options?.viewerUserId
          ? {
              where: { userId: options.viewerUserId },
              select: { state: true },
              take: 1,
            }
          : false,
      },
    });
    if (!realm) return false;
    if (realm.isPublic) return true;
    if (realm.unit.userId && realm.unit.userId === options?.viewerUserId) {
      return true;
    }

    const memberState = realm.members?.[0]?.state;
    return memberState === "ACTIVE" || memberState === "MUTED";
  }

  /** Get a single post by unit ID. */
  async getByUnitId(
    unitId: string,
    options?: { isAdmin?: boolean; allowTombstone?: boolean },
  ): Promise<PostWithRelations> {
    const post = await prisma.post.findUnique({
      where: { unitId },
      include: postInclude,
    });
    if (!post) {
      const comment = await prisma.comment.findUnique({
        where: { unitId },
        include: commentIncludeForPostCompat,
      });
      if (!comment) throw new AppError(404, `Post not found: ${unitId}`);
      if (
        !options?.isAdmin &&
        !options?.allowTombstone &&
        (comment.unit.status !== UnitStatus.PUBLISHED ||
          comment.unit.visibility !== "PUBLIC")
      ) {
        throw new AppError(404, `Post not found: ${unitId}`);
      }
      const compat = commentAsPostCompat(
        (
          await attachCommentPathsForPostCompat([
            comment as CommentWithRelations,
          ])
        )[0]!,
      );
      const [withPin] = await attachPinKinds([compat]);
      return hydrateUnitOwnerUserSlugRow(withPin);
    }
    if (
      !options?.isAdmin &&
      !options?.allowTombstone &&
      (post.unit.status !== UnitStatus.PUBLISHED ||
        post.unit.visibility !== "PUBLIC")
    ) {
      throw new AppError(404, `Post not found: ${unitId}`);
    }
    const [withPath] = await attachPinKinds(
      await attachPostPaths([post as PostWithRelations]),
    );
    return hydrateUnitOwnerUserSlugRow(withPath);
  }

  async getPrimaryVisibleRealmForPost(unitId: string): Promise<string | null> {
    const post = await prisma.post.findUnique({
      where: { unitId },
      select: {
        unit: {
          select: {
            inRealms: {
              where: { state: "VISIBLE" },
              select: { realmUnitId: true },
              take: 1,
            },
          },
        },
      },
    });

    return post?.unit.inRealms[0]?.realmUnitId ?? null;
  }

  private async assertRealmPostAllowed(
    realmUnitIds: string[],
    userId: string,
  ): Promise<void> {
    if (realmUnitIds.length === 0) return;

    const [realms, memberships, acknowledgements] = await Promise.all([
      prisma.realm.findMany({
        where: { unitId: { in: realmUnitIds } },
        select: {
          unitId: true,
          extra: true,
          ruleVersion: true,
          ruleRequireOnPost: true,
        },
      }),
      prisma.realmMember.findMany({
        where: { realmUnitId: { in: realmUnitIds }, userId },
        select: { realmUnitId: true, state: true },
      }),
      prisma.realmRuleAcknowledgement.findMany({
        where: { realmUnitId: { in: realmUnitIds }, userId },
        select: { realmUnitId: true, ruleUnitId: true, version: true },
      }),
    ]);

    const memberByRealm = new Map(
      memberships.map((member) => [member.realmUnitId, member]),
    );
    const acknowledgementKeys = new Set(
      acknowledgements.map(
        (ack) => `${ack.realmUnitId}:${ack.ruleUnitId}:${ack.version}`,
      ),
    );

    for (const realm of realms) {
      const memberState = memberByRealm.get(realm.unitId)?.state;
      if (
        memberState &&
        ["PENDING", "MUTED", "REMOVED", "BANNED"].includes(memberState)
      ) {
        throw new Error(
          `Cannot post to realm while membership state is ${memberState.toLowerCase()}`,
        );
      }

      const ruleUnitId = readRealmRuleUnitId(realm.extra);
      if (
        realm.ruleRequireOnPost &&
        ruleUnitId &&
        !acknowledgementKeys.has(
          `${realm.unitId}:${ruleUnitId}:${realm.ruleVersion}`,
        )
      ) {
        throw new Error("Realm rules must be acknowledged before posting");
      }
    }
  }

  private assertRealmReplyLifecycleAllowed(input: {
    realmUnitIds: string[];
    overlays: { realmUnitId: string; state: string }[];
  }) {
    const realmUnitIds = new Set(input.realmUnitIds);
    const blocking = input.overlays.find(
      (overlay) =>
        realmUnitIds.has(overlay.realmUnitId) &&
        REALM_REPLY_BLOCKING_MODERATION_STATES.includes(overlay.state as any),
    );
    if (!blocking) return;

    if (blocking.state === "LOCKED") {
      throw new Error("Cannot reply to locked realm content");
    }
    if (blocking.state === "ARCHIVED") {
      throw new Error("Cannot reply to archived realm content");
    }
    throw new Error(
      `Cannot reply to realm content in moderation state ${blocking.state.toLowerCase()}`,
    );
  }

  /**
   * Create a post with tree handling.
   *
   * Top-level post: rootPostUnitId = own unitId, depth = 0, path = one label.
   * Reply: inherits root from parent, depth = parent.depth + 1, path =
   *        parent.path || one freshly minted label (append-only, race-free).
   *
   * The `path` ltree column is `Unsupported` in Prisma, so it is written via
   * raw SQL after the typed insert and read back via `attachPostPaths`.
   */
  async create(
    input: CreatePostInput,
    authorUserId: string,
  ): Promise<PostWithRelations> {
    const {
      targetUnitId: inputTargetUnitId,
      realmUnitIds,
      tagIds,
      parentPostUnitId,
      kind,
      content,
      scoreEntryId,
      extra,
    } = input;

    if (parentPostUnitId) {
      return this.createReplyComment(input, authorUserId);
    }

    // Drafts apply to top-level posts only; replies and chapters always
    // publish. A draft is owner-only and stays out of feeds/search until
    // published (see publication-policy `publicUnitEligibilityWhere`).
    const asDraft =
      input.status === "DRAFT" &&
      !parentPostUnitId &&
      kind !== PostKindEnum.CHAPTER;
    let targetUnitId = inputTargetUnitId;
    let realmIdsToWrite = parentPostUnitId
      ? []
      : [...new Set(realmUnitIds ?? [])];
    const tagIdsToWrite = [...new Set(tagIds ?? [])];

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
    }

    let depth = 0;
    let rootPostUnitId: string | undefined;

    if (parentPostUnitId) {
      const parent = await prisma.post.findUniqueOrThrow({
        where: { unitId: parentPostUnitId },
        select: {
          unitId: true,
          rootPostUnitId: true,
          targetUnitId: true,
          depth: true,
          isLocked: true,
          unit: {
            select: {
              inRealms: {
                select: { realmUnitId: true, state: true },
              },
              realmModerationTargets: {
                select: { realmUnitId: true, state: true },
              },
            },
          },
        },
      });

      if (parent.isLocked) {
        throw new Error("Cannot reply to a locked post");
      }

      rootPostUnitId = parent.rootPostUnitId ?? parent.unitId;
      realmIdsToWrite = parent.unit.inRealms
        .filter((realm) => realm.state === "VISIBLE")
        .map((realm) => realm.realmUnitId);
      this.assertRealmReplyLifecycleAllowed({
        realmUnitIds: realmIdsToWrite,
        overlays: parent.unit.realmModerationTargets,
      });
      if (rootPostUnitId !== parent.unitId && realmIdsToWrite.length > 0) {
        const root = await prisma.post.findUnique({
          where: { unitId: rootPostUnitId },
          select: {
            isLocked: true,
            unit: {
              select: {
                realmModerationTargets: {
                  select: { realmUnitId: true, state: true },
                },
              },
            },
          },
        });
        if (root?.isLocked) {
          throw new Error("Cannot reply to a locked post");
        }
        this.assertRealmReplyLifecycleAllowed({
          realmUnitIds: realmIdsToWrite,
          overlays: root?.unit.realmModerationTargets ?? [],
        });
      }
      depth = parent.depth + 1;
      targetUnitId = parent.targetUnitId ?? rootPostUnitId;
    }

    await this.assertRealmPostAllowed(realmIdsToWrite, authorUserId);

    const post = await prisma.$transaction(async (tx) => {
      const ownerUserId =
        kind === "WIKI" ? await resolveRezicsWikiUserId() : authorUserId;
      const wikiLanguage =
        kind === "WIKI" ? (input.language ?? DEFAULT_LANGUAGE) : null;
      const unit = await tx.unit.create({
        data: {
          userId: ownerUserId,
          slugScope: ownerUserId,
          type: UnitType.POST,
          status: asDraft ? UnitStatus.DRAFT : UnitStatus.PUBLISHED,
          publishedAt: asDraft ? null : new Date(),
          defaultLanguage: wikiLanguage ?? undefined,
          supportLanguages: wikiLanguage
            ? { create: { language: wikiLanguage, isPrimary: true } }
            : undefined,
        },
      });

      // Validate the requested tags once (selecting slug), rejecting unknown
      // ids, and derive the lifecycle initialization from the same rows: a
      // stateful tag snapshots its slug into `extra.stateSchemaTag` and seeds
      // `state` to the schema's initial value. At most one stateful tag.
      let statefulInit: { tagSlug: string; initial: string } | null = null;
      if (tagIdsToWrite.length > 0) {
        const validTags = await tx.unit.findMany({
          where: {
            id: { in: tagIdsToWrite },
            type: UnitType.TAG,
            status: { not: UnitStatus.DELETED },
          },
          select: { id: true, slug: true },
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
        statefulInit = this.resolveStatefulTagInit(validTags);
      }
      const extraToWrite = statefulInit
        ? {
            ...(extra && typeof extra === "object" && !Array.isArray(extra)
              ? (extra as Record<string, unknown>)
              : {}),
            stateSchemaTag: statefulInit.tagSlug,
          }
        : extra;

      const createData: Prisma.PostUncheckedCreateInput = {
        unitId: unit.id,
        authorUserId,
        targetUnitId: targetUnitId ?? undefined,
        content: content as Prisma.InputJsonValue,
        kind: (kind as PostKind) ?? undefined,
        scoreEntryId: scoreEntryId ?? undefined,
        depth,
        state: statefulInit?.initial ?? undefined,
        extra: extraToWrite as Prisma.InputJsonValue | undefined,
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
            tx.unitRealm.create({
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
        // Tags were validated above (before the post insert); just write the
        // UnitTag junction rows here.
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

      // Top-level post: set rootPostUnitId to own unitId and mint a
      // single-label path. `path` is Unsupported in Prisma, so it is written
      // via raw SQL (the label comes from the shared sequence, base36-encoded).
      if (!parentPostUnitId) {
        await tx.$executeRaw`
          UPDATE "Post"
          SET "path" = text2ltree(rezics_to_base36(nextval('post_path_label_seq')))
          WHERE "unitId" = ${created.unitId}::uuid
        `;
        const updated = await tx.post.update({
          where: { unitId: created.unitId },
          data: { rootPostUnitId: created.unitId },
          include: postInclude,
        });

        result = updated as PostWithRelations;
      } else {
        // Reply: append-only path generation — `path = parent.path || label`
        // computed entirely in SQL, so there is no read-max-then-write race and
        // no ancestor row is ever rewritten.
        await tx.$executeRaw`
          UPDATE "Post" AS c
          SET "path" = p."path" || text2ltree(rezics_to_base36(nextval('post_path_label_seq')))
          FROM "Post" AS p
          WHERE c."unitId" = ${created.unitId}::uuid
            AND p."unitId" = ${parentPostUnitId}::uuid
        `;

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
        await upsertWikiContentTranslation(tx, {
          unitId: result.unitId,
          language: wikiLanguage ?? DEFAULT_LANGUAGE,
          content: result.content,
          actorUserId: authorUserId,
          status: wikiContentTranslationStatus(asDraft),
        });
        await writeEditorialMetadataHistory(tx as any, {
          unitId: result.unitId,
          actorUserId: authorUserId,
          patch: wikiPostContentHistoryPatch(result.content),
          message: "wiki-post.create",
        });
      }

      return result;
    });

    // Drafts are owner-only and must not enter the search index until they are
    // published; `setPublicationState` enqueues the sync on publish.
    if (!asDraft) {
      await Promise.all([
        enqueuePostSync(post.unitId),
        enqueueContentSync(post.unitId),
      ]);
    }

    const [withPath] = await attachPostPaths([post]);
    return hydrateUnitOwnerUserSlugRow(withPath);
  }

  private async createReplyComment(
    input: CreatePostInput,
    authorUserId: string,
  ): Promise<PostWithRelations> {
    const parentUnitId = input.parentPostUnitId;
    if (!parentUnitId) throw new AppError(400, "Missing parentPostUnitId");

    const parentComment = await prisma.comment.findUnique({
      where: { unitId: parentUnitId },
      select: {
        unitId: true,
        rootUnitId: true,
        realmUnitId: true,
      },
    });

    if (parentComment) {
      const comment = await commentService.create(
        {
          rootUnitId: parentComment.rootUnitId,
          realmUnitId: parentComment.realmUnitId,
          parentCommentUnitId: parentComment.unitId,
          content: input.content,
        },
        authorUserId,
      );
      return commentAsPostCompat(comment);
    }

    const parentPost = await prisma.post.findUniqueOrThrow({
      where: { unitId: parentUnitId },
      select: {
        unitId: true,
        rootPostUnitId: true,
        isLocked: true,
        unit: {
          select: {
            inRealms: {
              select: { realmUnitId: true, state: true },
            },
            realmModerationTargets: {
              select: { realmUnitId: true, state: true },
            },
          },
        },
      },
    });
    if (parentPost.isLocked) throw new Error("Cannot reply to a locked post");

    const rootUnitId = parentPost.rootPostUnitId ?? parentPost.unitId;
    const visibleRealmIds = parentPost.unit.inRealms
      .filter((realm) => realm.state === "VISIBLE")
      .map((realm) => realm.realmUnitId);
    const explicitRealmIds = [...new Set(input.realmUnitIds ?? [])];
    const realmUnitId =
      explicitRealmIds.length === 1
        ? explicitRealmIds[0]
        : visibleRealmIds.length === 1
          ? visibleRealmIds[0]
          : null;

    if (!realmUnitId) {
      throw new AppError(
        400,
        "Comment realmUnitId is required for roots without exactly one visible realm",
      );
    }

    this.assertRealmReplyLifecycleAllowed({
      realmUnitIds: [realmUnitId],
      overlays: parentPost.unit.realmModerationTargets,
    });
    await this.assertRealmPostAllowed([realmUnitId], authorUserId);

    const comment = await commentService.create(
      {
        rootUnitId,
        realmUnitId,
        content: input.content,
      },
      authorUserId,
    );
    return commentAsPostCompat(comment);
  }

  /**
   * Toggle a post between published and draft. Owner-only. Publishing sets
   * `publishedAt` once (first publication is preserved) and indexes the post;
   * reverting to draft removes it from feeds/search via the publication policy
   * and re-syncs the index to de-list it.
   */
  async setPublicationState(
    unitId: string,
    publish: boolean,
    authorUserId: string,
  ): Promise<PostWithRelations> {
    const existing = await prisma.post.findUniqueOrThrow({
      where: { unitId },
      select: {
        authorUserId: true,
        kind: true,
        unit: { select: { status: true, publishedAt: true } },
      },
    });
    if (existing.authorUserId !== authorUserId) {
      throw new AppError(403, "Only the author can change publication state");
    }
    if (existing.unit.status === UnitStatus.DELETED) {
      throw new AppError(409, "Cannot publish a deleted post");
    }

    const updated = await prisma.post.update({
      where: { unitId },
      data: {
        unit: {
          update: {
            status: publish ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
            // Preserve the first-publication timestamp; set it on first publish.
            publishedAt: publish
              ? (existing.unit.publishedAt ?? new Date())
              : existing.unit.publishedAt,
          },
        },
      },
      include: postInclude,
    });

    if (existing.kind === "WIKI") {
      await prisma.contentTranslation.updateMany({
        where: { unitId },
        data: { status: wikiContentTranslationStatus(!publish) },
      });
    }

    // Re-sync either way: publish indexes; unpublish de-lists (the indexer
    // honours `publicUnitEligibilityWhere`).
    await Promise.all([enqueuePostSync(unitId), enqueueContentSync(unitId)]);

    return hydrateUnitOwnerUserSlugRow(updated as PostWithRelations);
  }

  /** Update post content, isLocked, and/or extra. */
  async update(
    unitId: string,
    input: UpdatePostInput,
    actor?: RezicsSessionClaims,
    historyInput?: Pick<
      EditorialPatchSubmission,
      "patch" | "message" | "restoreSource"
    >,
  ): Promise<PostWithRelations> {
    const data: Prisma.PostUpdateInput = {};

    if (input.content !== undefined)
      data.content = input.content as Prisma.InputJsonValue;
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
      if (input.content !== undefined) patchFields.content = input.content;
      if (input.isLocked !== undefined) patchFields.isLocked = input.isLocked;
      if (input.extra !== undefined) patchFields.extra = input.extra;
      await enqueuePostFields(unitId, patchFields);
      if (input.content !== undefined) await enqueueContentSync(unitId);

      return hydrateUnitOwnerUserSlugRow(updated as PostWithRelations);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.post.findUniqueOrThrow({
        where: { unitId },
        select: {
          kind: true,
          content: true,
          unit: { select: { defaultLanguage: true, status: true } },
        },
      });
      const isWikiContentMainEdit =
        existing.kind === "WIKI" &&
        input.content !== undefined &&
        !jsonEquivalent(
          mainMarkdownSource(existing.content),
          mainMarkdownSource(input.content),
        );

      if (isWikiContentMainEdit && actor) {
        const submittedPaths = historyInput?.patch
          ? collectPatchLeafPaths(historyInput.patch)
          : ["post.content.main"];
        const supportedMainPaths = submittedPaths.filter(
          (path) =>
            path === "post.content" ||
            path === "post.content.main" ||
            path.startsWith("post.content.main."),
        );
        await assertCanEditCollaborativeMetadata(
          tx as any,
          actor,
          unitId,
          supportedMainPaths.length > 0
            ? supportedMainPaths
            : ["post.content.main"],
        );
      }

      const row = await tx.post.update({
        where: { unitId },
        data,
        include: postInclude,
      });

      if (isWikiContentMainEdit && actor) {
        await upsertWikiContentTranslation(tx, {
          unitId,
          language:
            input.language ?? existing.unit.defaultLanguage ?? DEFAULT_LANGUAGE,
          content: input.content,
          actorUserId: actor.userId,
          status: wikiContentTranslationStatus(
            existing.unit.status === UnitStatus.DRAFT,
          ),
        });
        await writeEditorialMetadataHistory(tx as any, {
          unitId,
          actorUserId: actor.userId,
          patch:
            historyInput?.patch ?? wikiPostContentHistoryPatch(row.content),
          message: historyInput?.message ?? "wiki-post.content.update",
          restoreSource: historyInput?.restoreSource,
        });
      }

      return row;
    });

    const patchFields: Record<string, any> = {};
    if (input.content !== undefined) patchFields.content = input.content;
    if (input.isLocked !== undefined) patchFields.isLocked = input.isLocked;
    if (input.extra !== undefined) patchFields.extra = input.extra;
    await enqueuePostFields(unitId, patchFields);
    if (input.content !== undefined) await enqueueContentSync(unitId);

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

      // Clear the post content
      await tx.post.update({
        where: { unitId },
        data: { content: Prisma.JsonNull },
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

    await Promise.all([enqueuePostSync(unitId), enqueueContentSync(unitId)]);
  }

  // ============================================================
  // LIFECYCLE STATE — schema-driven, behaviorally inert
  // ============================================================

  /**
   * Derive the lifecycle initialization from a post's (already-validated) tags.
   * Picks out stateful tags (those keying a schema) and enforces **at most one**.
   * Returns the governing tag slug and the schema's initial state, or `null`
   * when no stateful tag is present.
   */
  private resolveStatefulTagInit(
    tags: { slug: string | null }[],
  ): { tagSlug: string; initial: string } | null {
    const statefulSlugs = tags
      .map((tag) => tag.slug)
      .filter((slug): slug is string => !!slug && isStatefulTagSlug(slug));
    if (statefulSlugs.length === 0) return null;
    if (statefulSlugs.length > 1) {
      throw new AppError(
        400,
        `A post may bear at most one stateful tag; got: ${statefulSlugs.join(", ")}`,
      );
    }
    const tagSlug = statefulSlugs[0];
    const schema = tagSlug ? getStateSchema(tagSlug) : undefined;
    if (!tagSlug || !schema) return null;
    return { tagSlug, initial: schema.initial };
  }

  /**
   * Transition a post's lifecycle `state` to `target`. Write-strict: the target
   * is normalized and rejected unless it is a legal value of the post's schema
   * and the transition from the current state is allowed. A no-op when the post
   * is already in the target state.
   *
   * ⚠ Security-critical: `state` gates NO behavior. Authorization and hard gates
   * key only on `Post.isLocked` (reply permission) and `Unit.status` (visibility),
   * never on `state` — `state` is user-influenced presentation data (per-realm
   * rendering today, custom schemas later) and must never control authorization.
   * This only changes the label; authorization is the caller's concern.
   */
  async setState(unitId: string, target: string): Promise<PostWithRelations> {
    const existing = await prisma.post.findUniqueOrThrow({
      where: { unitId },
      select: { state: true, extra: true },
    });
    const schemaTag = readStateSchemaTag(existing.extra);
    const schema = schemaTag ? getStateSchema(schemaTag) : undefined;
    if (!schema) {
      throw new AppError(400, "Post has no lifecycle state schema");
    }

    const normalized = normalizeStateSlug(target);
    if (!isLegalStateValue(schema, normalized)) {
      throw new AppError(400, `Illegal state value: ${normalized}`);
    }

    const current = existing.state ?? schema.initial;
    if (current === normalized) {
      return this.getByUnitId(unitId, { isAdmin: true, allowTombstone: true });
    }
    if (!isLegalTransition(schema, current, normalized)) {
      throw new AppError(
        400,
        `Disallowed state transition: ${current} → ${normalized}`,
      );
    }

    const updated = await prisma.post.update({
      where: { unitId },
      data: { state: normalized },
      include: postInclude,
    });
    await enqueuePostFields(unitId, { state: normalized });
    return hydrateUnitOwnerUserSlugRow(updated as PostWithRelations);
  }

  /**
   * Maintain the `solved` cache when an answer is accepted: `open` ⇒ `solved`.
   * The `ACCEPTED_ANSWER` pin stays the source of truth; this is a denormalized
   * shadow (precedent: `replyCount`/`lastReplyAt`). A manually-set closed reason
   * is never overwritten — only the schema's initial (`open`) advances.
   */
  private async maintainSolvedCacheOnAccept(
    scopeUnitId: string,
  ): Promise<void> {
    const root = await prisma.post.findUnique({
      where: { unitId: scopeUnitId },
      select: { state: true, extra: true },
    });
    if (!root) return;
    const schemaTag = readStateSchemaTag(root.extra);
    const schema = schemaTag ? getStateSchema(schemaTag) : undefined;
    if (!schema || !isLegalStateValue(schema, "solved")) return;
    if (root.state === schema.initial) {
      await prisma.post.update({
        where: { unitId: scopeUnitId },
        data: { state: "solved" },
      });
      await enqueuePostFields(scopeUnitId, { state: "solved" });
    }
  }

  /**
   * Maintain the `solved` cache when an answer is unaccepted: when no accepted
   * answer remains and the cached state is still `solved`, revert to the
   * schema's initial (`open`). A manual closed reason is left untouched.
   */
  private async maintainSolvedCacheOnUnaccept(
    scopeUnitId: string,
  ): Promise<void> {
    const remaining = await prisma.postPin.count({
      where: { scopeUnitId, kind: PinKindEnum.ACCEPTED_ANSWER },
    });
    if (remaining > 0) return;
    const root = await prisma.post.findUnique({
      where: { unitId: scopeUnitId },
      select: { state: true, extra: true },
    });
    if (!root) return;
    const schemaTag = readStateSchemaTag(root.extra);
    const schema = schemaTag ? getStateSchema(schemaTag) : undefined;
    if (!schema) return;
    if (root.state === "solved") {
      await prisma.post.update({
        where: { unitId: scopeUnitId },
        data: { state: schema.initial },
      });
      await enqueuePostFields(scopeUnitId, { state: schema.initial });
    }
  }

  // ============================================================
  // PROMOTION OVERLAY — pinning & accepted answers
  // ============================================================

  /**
   * A thread is a Q&A thread when its root post bears the platform-reserved
   * question tag (a `Unit(type=TAG)` whose slug is `OFFICIAL_QUESTION_TAG_SLUG`).
   */
  async isQuestionThread(rootPostUnitId: string): Promise<boolean> {
    const tag = await prisma.unit.findFirst({
      where: { type: UnitType.TAG, slug: OFFICIAL_QUESTION_TAG_SLUG },
      select: { id: true },
    });
    if (!tag) return false;
    const applied = await prisma.unitTag.findUnique({
      where: {
        unitId_tagUnitId: { unitId: rootPostUnitId, tagUnitId: tag.id },
      },
      select: { unitId: true },
    });
    return applied !== null;
  }

  /** Pin a reply within its thread scope (`kind = PINNED`). */
  async pin(
    input: PinPostInput,
    caller: RezicsSessionClaims,
  ): Promise<PostPinDTO> {
    await this.assertCanPromoteInThread(input.scopeUnitId, caller);
    await this.loadPromotableTarget(input.scopeUnitId, input.postUnitId);
    const position = await this.mintPinPosition(
      input.scopeUnitId,
      PinKindEnum.PINNED,
      input.beforePostUnitId,
      input.afterPostUnitId,
    );
    return this.createPin(
      input.scopeUnitId,
      input.postUnitId,
      PinKindEnum.PINNED,
      position,
      caller.userId,
    );
  }

  /** Remove a `PINNED` promotion. */
  async unpin(
    scopeUnitId: string,
    postUnitId: string,
    caller: RezicsSessionClaims,
  ): Promise<void> {
    await this.assertCanPromoteInThread(scopeUnitId, caller);
    await this.deletePin(scopeUnitId, postUnitId, PinKindEnum.PINNED);
  }

  /**
   * Accept a direct reply as an answer (`kind = ACCEPTED_ANSWER`). Gated on a
   * Q&A thread, the target being a direct reply (`depth == 1`,
   * `parentPostUnitId == rootPostUnitId`), and OP/moderator authorization.
   */
  async acceptAnswer(
    input: AcceptAnswerInput,
    caller: RezicsSessionClaims,
  ): Promise<PostPinDTO> {
    await this.assertCanPromoteInThread(input.scopeUnitId, caller);
    const target = await this.loadPromotableTarget(
      input.scopeUnitId,
      input.postUnitId,
    );
    if (target.depth !== 1 || target.parentPostUnitId !== input.scopeUnitId) {
      throw new AppError(
        400,
        "An accepted answer must be a direct reply to the question",
      );
    }
    if (!(await this.isQuestionThread(input.scopeUnitId))) {
      throw new AppError(
        400,
        "Accepted answers require a Q&A thread (root post must bear the official question tag)",
      );
    }
    const position = await this.mintPinPosition(
      input.scopeUnitId,
      PinKindEnum.ACCEPTED_ANSWER,
      input.beforePostUnitId,
      input.afterPostUnitId,
    );
    const pin = await this.createPin(
      input.scopeUnitId,
      input.postUnitId,
      PinKindEnum.ACCEPTED_ANSWER,
      position,
      caller.userId,
    );
    await this.maintainSolvedCacheOnAccept(input.scopeUnitId);
    return pin;
  }

  /** Remove an `ACCEPTED_ANSWER` promotion. */
  async unacceptAnswer(
    scopeUnitId: string,
    postUnitId: string,
    caller: RezicsSessionClaims,
  ): Promise<void> {
    await this.assertCanPromoteInThread(scopeUnitId, caller);
    await this.deletePin(scopeUnitId, postUnitId, PinKindEnum.ACCEPTED_ANSWER);
    await this.maintainSolvedCacheOnUnaccept(scopeUnitId);
  }

  /**
   * Single scope-capability gate shared by pin and accept: permitted to the
   * thread author (OP), a platform admin, or a moderator/owner of a realm the
   * thread belongs to. Also validates that the scope IS a thread root post
   * (never a realm — that is `Realm.extra.pinboard`'s job — and never a reply).
   */
  private async assertCanPromoteInThread(
    scopeUnitId: string,
    caller: RezicsSessionClaims,
  ): Promise<void> {
    const scope = await prisma.post.findUnique({
      where: { unitId: scopeUnitId },
      select: {
        authorUserId: true,
        depth: true,
        rootPostUnitId: true,
        unit: {
          select: {
            type: true,
            inRealms: { select: { realmUnitId: true } },
          },
        },
      },
    });

    if (!scope) {
      const unit = await prisma.unit.findUnique({
        where: { id: scopeUnitId },
        select: { type: true },
      });
      if (unit?.type === UnitType.REALM) {
        throw new AppError(
          400,
          "A realm cannot be a PostPin scope; realm-level featuring belongs to Realm.extra.pinboard",
        );
      }
      throw new AppError(404, `Thread root post not found: ${scopeUnitId}`);
    }

    if (
      scope.depth !== 0 ||
      (scope.rootPostUnitId !== null && scope.rootPostUnitId !== scopeUnitId)
    ) {
      throw new AppError(400, "A PostPin scope must be a thread root post");
    }

    const allowed = await this.canPromoteInThread(
      {
        authorUserId: scope.authorUserId,
        realmUnitIds: scope.unit.inRealms.map((row) => row.realmUnitId),
      },
      caller,
    );
    if (!allowed) {
      throw new AppError(
        403,
        "Only the thread author or a realm moderator/owner may promote posts in this thread",
      );
    }
  }

  /**
   * Pure authorization decision shared by the write guard
   * (`assertCanPromoteInThread`, which throws on `false`) and the thread read
   * path (which surfaces it as `viewerCanPromote`). One code path, so the UI
   * affordance never drifts from what the server enforces. Takes an
   * already-loaded thread-root shape — structural validation (scope is a real
   * thread root, not a realm) stays in the guard. Returns `true` for the thread
   * author (OP), a platform admin, or a moderator/owner of a realm the thread
   * belongs to.
   */
  private async canPromoteInThread(
    scope: { authorUserId: string; realmUnitIds: string[] },
    caller: RezicsSessionClaims,
  ): Promise<boolean> {
    if (scope.authorUserId === caller.userId) return true;
    if (BasicAdminPermission(caller.permission as never)) return true;

    if (scope.realmUnitIds.length > 0) {
      const ownedRealm = await prisma.unit.findFirst({
        where: { id: { in: scope.realmUnitIds }, userId: caller.userId },
        select: { id: true },
      });
      if (ownedRealm) return true;
      const moderator = await prisma.realmMember.findFirst({
        where: {
          realmUnitId: { in: scope.realmUnitIds },
          userId: caller.userId,
          roleKey: { in: [...PROMOTION_ROLES] },
        },
        select: { realmUnitId: true },
      });
      if (moderator) return true;
    }

    return false;
  }

  /**
   * Thread-scoped viewer signals for the thread read path: whether the caller
   * may pin/accept in this thread (`viewerCanPromote`) and whether the thread is
   * a Q&A thread (`isQuestionThread`). Computed once per thread read. Anonymous
   * callers always get `viewerCanPromote = false`; `viewerCanPromote` reuses the
   * same `canPromoteInThread` decision the write guard enforces, so a shown
   * control mirrors server truth.
   */
  async getThreadPromotionSignals(
    rootPostUnitId: string,
    caller: RezicsSessionClaims | null | undefined,
  ): Promise<{ viewerCanPromote: boolean; isQuestionThread: boolean }> {
    const isQuestion = await this.isQuestionThread(rootPostUnitId);
    if (!caller?.userId) {
      return { viewerCanPromote: false, isQuestionThread: isQuestion };
    }

    const scope = await prisma.post.findUnique({
      where: { unitId: rootPostUnitId },
      select: {
        authorUserId: true,
        depth: true,
        rootPostUnitId: true,
        unit: { select: { inRealms: { select: { realmUnitId: true } } } },
      },
    });

    // Only a real thread root can be promoted into; anything else → false.
    if (
      !scope ||
      scope.depth !== 0 ||
      (scope.rootPostUnitId !== null && scope.rootPostUnitId !== rootPostUnitId)
    ) {
      return { viewerCanPromote: false, isQuestionThread: isQuestion };
    }

    const viewerCanPromote = await this.canPromoteInThread(
      {
        authorUserId: scope.authorUserId,
        realmUnitIds: scope.unit.inRealms.map((row) => row.realmUnitId),
      },
      caller,
    );
    return { viewerCanPromote, isQuestionThread: isQuestion };
  }

  /** Validate the target is a reply within the scope thread; return its shape. */
  private async loadPromotableTarget(
    scopeUnitId: string,
    postUnitId: string,
  ): Promise<{ depth: number; parentPostUnitId: string | null }> {
    const target = await prisma.post.findUnique({
      where: { unitId: postUnitId },
      select: { depth: true, rootPostUnitId: true, parentPostUnitId: true },
    });
    if (!target) {
      const comment = await prisma.comment.findUnique({
        where: { unitId: postUnitId },
        select: {
          depth: true,
          rootUnitId: true,
          parentCommentUnitId: true,
        },
      });
      if (!comment) {
        throw new AppError(404, `Post not found: ${postUnitId}`);
      }
      if (comment.rootUnitId !== scopeUnitId) {
        throw new AppError(
          400,
          "Target post does not belong to the scope thread",
        );
      }
      if (comment.depth < 1) {
        throw new AppError(400, "Only replies (depth >= 1) can be promoted");
      }
      return {
        depth: comment.depth,
        parentPostUnitId: comment.parentCommentUnitId ?? scopeUnitId,
      };
    }
    if (target.rootPostUnitId !== scopeUnitId) {
      throw new AppError(
        400,
        "Target post does not belong to the scope thread",
      );
    }
    if (target.depth < 1) {
      throw new AppError(400, "Only replies (depth >= 1) can be promoted");
    }
    return { depth: target.depth, parentPostUnitId: target.parentPostUnitId };
  }

  /**
   * Mint a fractional `position` within the `(scope, kind)` group. Explicit
   * before/after anchors place precisely; otherwise the pin appends after the
   * current last pin in the group. Reordering one pin never renumbers others.
   */
  private async mintPinPosition(
    scopeUnitId: string,
    kind: PinKindEnum,
    beforePostUnitId?: string,
    afterPostUnitId?: string,
  ): Promise<string> {
    const positionOf = async (postUnitId?: string) => {
      if (!postUnitId) return undefined;
      const pin = await prisma.postPin.findUnique({
        where: { scopeUnitId_postUnitId: { scopeUnitId, postUnitId } },
        select: { position: true },
      });
      return pin?.position ?? undefined;
    };
    const afterPos = await positionOf(afterPostUnitId);
    const beforePos = await positionOf(beforePostUnitId);
    if (afterPos !== undefined || beforePos !== undefined) {
      return generateBetween(afterPos, beforePos);
    }
    const last = await prisma.postPin.findFirst({
      where: { scopeUnitId, kind },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return generateBetween(last?.position ?? undefined, undefined);
  }

  private async createPin(
    scopeUnitId: string,
    postUnitId: string,
    kind: PinKindEnum,
    position: string,
    byUserId: string,
  ): Promise<PostPinDTO> {
    try {
      const pin = await prisma.postPin.create({
        data: { scopeUnitId, postUnitId, kind, position, byUserId },
      });
      return mapPostPinToDTO(pin);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        (error as { code?: string }).code === "P2002"
      ) {
        throw new AppError(409, "This post is already promoted in this scope");
      }
      throw error;
    }
  }

  private async deletePin(
    scopeUnitId: string,
    postUnitId: string,
    kind: PinKindEnum,
  ): Promise<void> {
    const existing = await prisma.postPin.findUnique({
      where: { scopeUnitId_postUnitId: { scopeUnitId, postUnitId } },
      select: { kind: true },
    });
    if (!existing || existing.kind !== kind) {
      throw new AppError(404, "Promotion not found for this post and scope");
    }
    await prisma.postPin.delete({
      where: { scopeUnitId_postUnitId: { scopeUnitId, postUnitId } },
    });
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

function wikiPostContentHistoryPatch(
  content: unknown,
): Record<string, unknown> {
  const source = mainMarkdownSource(content);
  return source === null
    ? { post: { content } }
    : { post: { content: { main: { source } } } };
}

export const postService = new PostService();

function jsonEquivalent(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
