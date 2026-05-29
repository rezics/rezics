import type {
  CreatePostInput,
  EditorialPatchSubmission,
  PostListQuery,
  RezicsSessionClaims,
  UpdatePostInput,
} from "@rezics/contract";
import { mainMarkdownSource, parseIdsCsv } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import {
  type PostKind,
  PostKind as PostKindEnum,
  Prisma,
  prisma,
  UnitStatus,
  UnitType,
  UnitWorkDisplayPolicy,
  UnitWorkRole,
} from "#/prisma/client";
import { resolveRezicsWikiUserId } from "@/infra/infra-users";
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
import { AppError } from "../utils/errors";
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

function postKindToWorkRole(kind: PostKindEnum | undefined): UnitWorkRole {
  if (kind === PostKindEnum.REVIEW) return UnitWorkRole.REVIEW;
  if (kind === PostKindEnum.WIKI) return UnitWorkRole.WIKI;
  return UnitWorkRole.POST;
}

function readRealmRuleUnitId(extra: Prisma.JsonValue | null): string | null {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return null;
  const rule = (extra as Record<string, unknown>).rule;
  return typeof rule === "string" && rule.length > 0 ? rule : null;
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

function realmLifecycleStateFilter(
  state: PostListQuery["realmLifecycleState"],
) {
  if (!state || state === "all") return undefined;
  return state.toUpperCase();
}

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
    this.applyWorkDomainFilter(where, query.workUnitId, query.workRoles);
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
    this.applyWorkDomainFilter(where, opts.workUnitId, opts.workRoles);
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
      content,
      scoreEntryId,
      extra,
    } = input;
    // Drafts apply to top-level posts only; replies and chapters always
    // publish. A draft is owner-only and stays out of feeds/search until
    // published (see publication-policy `publicUnitEligibilityWhere`).
    const asDraft =
      input.status === "DRAFT" &&
      !parentPostUnitId &&
      kind !== PostKindEnum.CHAPTER;
    let realmIdsToWrite = parentPostUnitId
      ? []
      : [...new Set(realmUnitIds ?? [])];
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

    await this.assertRealmPostAllowed(realmIdsToWrite, authorUserId);

    const post = await prisma.$transaction(async (tx) => {
      const ownerUserId =
        kind === "WIKI" ? await resolveRezicsWikiUserId() : authorUserId;
      const unit = await tx.unit.create({
        data: {
          userId: ownerUserId,
          slugScope: ownerUserId,
          type: UnitType.POST,
          status: asDraft ? UnitStatus.DRAFT : UnitStatus.PUBLISHED,
          publishedAt: asDraft ? null : new Date(),
        },
      });

      const createData: Prisma.PostUncheckedCreateInput = {
        unitId: unit.id,
        authorUserId,
        targetUnitId: targetUnitId ?? undefined,
        rootTargetUnitId: rootTargetUnitId ?? undefined,
        rootTargetUnitType: rootTargetUnitType ?? undefined,
        content: content as Prisma.InputJsonValue,
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

      if (targetUnitId) {
        await this.registerTargetWorkMemberships(
          tx,
          created.unitId,
          targetUnitId,
          postKindToWorkRole(kind),
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

    return hydrateUnitOwnerUserSlugRow(post);
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
        select: { kind: true, content: true },
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

  private applyWorkDomainFilter(
    where: Prisma.PostWhereInput,
    workUnitId?: string,
    workRoles?: PostListQuery["workRoles"],
  ) {
    if (!workUnitId) return;

    const roles = workRoles?.length
      ? (workRoles as UnitWorkRole[])
      : [UnitWorkRole.POST, UnitWorkRole.REVIEW, UnitWorkRole.WIKI];

    where.unit = {
      ...(where.unit && !Array.isArray(where.unit) ? where.unit : {}),
      workMemberships: {
        some: {
          workUnitId,
          role: { in: roles },
        },
      },
    };
  }

  private async registerTargetWorkMemberships(
    tx: Prisma.TransactionClient,
    unitId: string,
    targetUnitId: string,
    role: UnitWorkRole,
  ) {
    const releaseMemberships = await tx.unitWork.findMany({
      where: {
        unitId: targetUnitId,
        role: UnitWorkRole.RELEASE,
      },
      select: { workUnitId: true },
      distinct: ["workUnitId"],
    });

    await Promise.all(
      releaseMemberships.map((membership) =>
        tx.unitWork.upsert({
          where: {
            unitId_workUnitId_role: {
              unitId,
              workUnitId: membership.workUnitId,
              role,
            },
          },
          update: {},
          create: {
            unitId,
            workUnitId: membership.workUnitId,
            role,
            displayPolicy: UnitWorkDisplayPolicy.PRIMARY,
          },
        }),
      ),
    );
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
