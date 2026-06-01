import type {
  AcceptAnswerInput,
  CreatePostInput,
  EditorialPatchSubmission,
  PinCommentInput,
  PostListQuery,
  CommentPromotionDTO,
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
import { AppError } from "../utils/errors";
import { mapCommentPromotionToDTO } from "./post.mapper";
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
      provenance: { source: "post-content" },
    },
    update: {
      content: input.content as Prisma.InputJsonValue,
      status: input.status,
      authorUserId: input.actorUserId,
      provenance: { source: "post-content" },
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
 * Attach the promotion overlay (`pinKind`/`pinPosition`) to thread rows. A
 * comment is promoted at most once per scope and its scope is always its own
 * thread root, so the target comment unit maps to at most one promotion row.
 */
async function attachPinKinds<
  T extends {
    unitId: string;
    pinKind?: PinKindEnum | null;
    pinPosition?: string | null;
  },
>(posts: T[]): Promise<T[]> {
  if (posts.length === 0) return posts;
  const pins = await prisma.commentPromotion.findMany({
    where: { commentUnitId: { in: posts.map((post) => post.unitId) } },
    select: { commentUnitId: true, kind: true, position: true },
  });
  const pinByCommentUnitId = new Map(
    pins.map((pin) => [pin.commentUnitId, pin]),
  );
  for (const post of posts) {
    const pin = pinByCommentUnitId.get(post.unitId);
    post.pinKind = pin?.kind ?? null;
    post.pinPosition = pin?.position ?? null;
  }
  return posts;
}

export class PostService {
  /**
   * List root submissions only. Reply tree reads live in the comment domain;
   * Post no longer stores discussion topology.
   */
  async list(
    query: PostListQuery = {},
    options?: { isAdmin?: boolean; viewerUserId?: string | null },
  ): Promise<{ posts: PostWithRelations[]; total: number }> {
    const limitNum = Math.max(1, Math.min(Number(query.limit ?? 50), 200));
    const skipNum = query.start ?? 0;

    const where: Prisma.PostWhereInput = options?.isAdmin
      ? {}
      : { unit: { ...publicUnitEligibilityWhere } };
    if (query.targetUnitId) {
      where.unit = {
        ...(typeof where.unit === "object" && !Array.isArray(where.unit)
          ? where.unit
          : {}),
        targetUnitId: query.targetUnitId,
      };
    }
    // Weak context lookup only: do not resolve through Unit.targetUnitId and do
    // not validate that the value names a VARIANT.
    if (query.variantUnitId) where.variantUnitId = query.variantUnitId;
    if (query.authorUserId) where.authorUserId = query.authorUserId;
    if (query.kind) where.kind = query.kind;
    applyStateFilter(where, query);

    const idList = parseIdsCsv(query.ids);
    if (idList && idList.length > 0) {
      where.unitId = { in: idList };
    }

    await applyBlockedAuthorFilter(where, options);

    const orderBy: Prisma.PostOrderByWithRelationInput[] = [
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
        await attachPinKinds(posts as PostWithRelations[]),
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

    if (opts.authorUserId) where.authorUserId = opts.authorUserId;
    if (opts.kind) where.kind = opts.kind;
    applyStateFilter(where, opts);

    await applyBlockedAuthorFilter(where, options);

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
        await attachPinKinds(posts as PostWithRelations[]),
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
      throw new AppError(404, `Post not found: ${unitId}`);
    }
    if (
      !options?.isAdmin &&
      !options?.allowTombstone &&
      (post.unit.status !== UnitStatus.PUBLISHED ||
        post.unit.visibility !== "PUBLIC")
    ) {
      throw new AppError(404, `Post not found: ${unitId}`);
    }
    const [withPin] = await attachPinKinds([post as PostWithRelations]);
    return hydrateUnitOwnerUserSlugRow(withPin);
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

  /**
   * Create a top-level post. Comment replies are created through the comment
   * domain; this path writes no post topology.
   */
  async create(
    input: CreatePostInput,
    authorUserId: string,
  ): Promise<PostWithRelations> {
    const {
      targetUnitId: inputTargetUnitId,
      realmUnitIds,
      tagIds,
      kind,
      content,
      scoreEntryId,
      extra,
      variantUnitId,
    } = input;

    // Chapters always publish. A draft is owner-only and stays out of
    // feeds/search until published (see publication-policy
    // `publicUnitEligibilityWhere`).
    const asDraft = input.status === "DRAFT" && kind !== PostKindEnum.CHAPTER;
    const targetUnitId = inputTargetUnitId;
    const realmIdsToWrite = [...new Set(realmUnitIds ?? [])];
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
          targetUnitId: targetUnitId ?? undefined,
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
        content: content as Prisma.InputJsonValue,
        kind: (kind as PostKind) ?? undefined,
        scoreEntryId: scoreEntryId ?? undefined,
        variantUnitId: variantUnitId ?? undefined,
        state: statefulInit?.initial ?? undefined,
        extra: extraToWrite as Prisma.InputJsonValue | undefined,
      };

      const created = (await tx.post.create({
        data: createData,
        include: postInclude,
      })) as PostWithRelations;

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

      if (kind === "WIKI") {
        await upsertWikiContentTranslation(tx, {
          unitId: created.unitId,
          language: wikiLanguage ?? DEFAULT_LANGUAGE,
          content: created.content,
          actorUserId: authorUserId,
          status: wikiContentTranslationStatus(asDraft),
        });
        await writeEditorialMetadataHistory(tx as any, {
          unitId: created.unitId,
          actorUserId: authorUserId,
          patch: wikiPostContentHistoryPatch(created.content),
          message: "wiki-post.create",
        });
      }

      return created;
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

  /** Delete a root submission. Comment reply counters are owned by Comment. */
  async delete(unitId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.post.findUniqueOrThrow({
        where: { unitId },
        select: { unitId: true },
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
    const remaining = await prisma.commentPromotion.count({
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
    input: PinCommentInput,
    caller: RezicsSessionClaims,
  ): Promise<CommentPromotionDTO> {
    await this.assertCanPromoteInThread(input.scopeUnitId, caller);
    await this.loadPromotableTarget(input.scopeUnitId, input.commentUnitId);
    const position = await this.mintPinPosition(
      input.scopeUnitId,
      PinKindEnum.PINNED,
      input.beforeTargetUnitId,
      input.afterTargetUnitId,
    );
    return this.createPin(
      input.scopeUnitId,
      input.commentUnitId,
      PinKindEnum.PINNED,
      position,
      caller.userId,
    );
  }

  /** Remove a `PINNED` promotion. */
  async unpin(
    scopeUnitId: string,
    commentUnitId: string,
    caller: RezicsSessionClaims,
  ): Promise<void> {
    await this.assertCanPromoteInThread(scopeUnitId, caller);
    await this.deletePin(scopeUnitId, commentUnitId, PinKindEnum.PINNED);
  }

  /**
   * Accept a direct reply as an answer (`kind = ACCEPTED_ANSWER`). Gated on a
   * Q&A thread, the target being a direct comment reply, and OP/moderator
   * authorization.
   */
  async acceptAnswer(
    input: AcceptAnswerInput,
    caller: RezicsSessionClaims,
  ): Promise<CommentPromotionDTO> {
    await this.assertCanPromoteInThread(input.scopeUnitId, caller);
    const target = await this.loadPromotableTarget(
      input.scopeUnitId,
      input.commentUnitId,
    );
    if (target.depth !== 1 || target.parentCommentUnitId !== null) {
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
      input.beforeTargetUnitId,
      input.afterTargetUnitId,
    );
    const pin = await this.createPin(
      input.scopeUnitId,
      input.commentUnitId,
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
    commentUnitId: string,
    caller: RezicsSessionClaims,
  ): Promise<void> {
    await this.assertCanPromoteInThread(scopeUnitId, caller);
    await this.deletePin(
      scopeUnitId,
      commentUnitId,
      PinKindEnum.ACCEPTED_ANSWER,
    );
    await this.maintainSolvedCacheOnUnaccept(scopeUnitId);
  }

  /**
   * Single scope-capability gate shared by pin and accept: permitted to the
   * thread author (OP), a platform admin, or a moderator/owner of a realm the
   * thread belongs to. Also validates that the scope IS a thread root post
   * (never a realm — that is `Realm.extra.pinboard`'s job).
   */
  private async assertCanPromoteInThread(
    scopeUnitId: string,
    caller: RezicsSessionClaims,
  ): Promise<void> {
    const scope = await prisma.post.findUnique({
      where: { unitId: scopeUnitId },
      select: {
        authorUserId: true,
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
          "A realm cannot be a comment promotion scope; realm-level featuring belongs to Realm.extra.pinboard",
        );
      }
      throw new AppError(404, `Thread root post not found: ${scopeUnitId}`);
    }

    const allowed = await this.canPromoteInThread(
      {
        authorUserId: scope.authorUserId,
        realmUnitIds: (scope.unit?.inRealms ?? []).map(
          (row) => row.realmUnitId,
        ),
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
        unit: { select: { inRealms: { select: { realmUnitId: true } } } },
      },
    });

    // Only a real thread root post can be promoted into; anything else -> false.
    if (!scope) {
      return { viewerCanPromote: false, isQuestionThread: isQuestion };
    }

    const viewerCanPromote = await this.canPromoteInThread(
      {
        authorUserId: scope.authorUserId,
        realmUnitIds: (scope.unit?.inRealms ?? []).map(
          (row) => row.realmUnitId,
        ),
      },
      caller,
    );
    return { viewerCanPromote, isQuestionThread: isQuestion };
  }

  /** Validate the target is a reply within the scope thread; return its shape. */
  private async loadPromotableTarget(
    scopeUnitId: string,
    commentUnitId: string,
  ): Promise<{ depth: number; parentCommentUnitId: string | null }> {
    const comment = await prisma.comment.findUnique({
      where: { unitId: commentUnitId },
      select: {
        depth: true,
        rootUnitId: true,
        parentCommentUnitId: true,
      },
    });
    if (!comment) {
      throw new AppError(404, `Promotable target not found: ${commentUnitId}`);
    }
    if (comment.rootUnitId !== scopeUnitId) {
      throw new AppError(
        400,
        "Target comment does not belong to the scope thread",
      );
    }
    if (comment.depth < 1) {
      throw new AppError(400, "Only replies (depth >= 1) can be promoted");
    }
    return {
      depth: comment.depth,
      parentCommentUnitId: comment.parentCommentUnitId,
    };
  }

  /**
   * Mint a fractional `position` within the `(scope, kind)` group. Explicit
   * before/after anchors place precisely; otherwise the pin appends after the
   * current last pin in the group. Reordering one pin never renumbers others.
   */
  private async mintPinPosition(
    scopeUnitId: string,
    kind: PinKindEnum,
    beforeTargetUnitId?: string,
    afterTargetUnitId?: string,
  ): Promise<string> {
    const positionOf = async (commentUnitId?: string) => {
      if (!commentUnitId) return undefined;
      const pin = await prisma.commentPromotion.findUnique({
        where: {
          scopeUnitId_commentUnitId: {
            scopeUnitId,
            commentUnitId: commentUnitId,
          },
        },
        select: { position: true },
      });
      return pin?.position ?? undefined;
    };
    const afterPos = await positionOf(afterTargetUnitId);
    const beforePos = await positionOf(beforeTargetUnitId);
    if (afterPos !== undefined || beforePos !== undefined) {
      return generateBetween(afterPos, beforePos);
    }
    const last = await prisma.commentPromotion.findFirst({
      where: { scopeUnitId, kind },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return generateBetween(last?.position ?? undefined, undefined);
  }

  private async createPin(
    scopeUnitId: string,
    commentUnitId: string,
    kind: PinKindEnum,
    position: string,
    byUserId: string,
  ): Promise<CommentPromotionDTO> {
    try {
      const pin = await prisma.commentPromotion.create({
        data: {
          scopeUnitId,
          commentUnitId: commentUnitId,
          kind,
          position,
          byUserId,
        },
      });
      return mapCommentPromotionToDTO(pin);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        (error as { code?: string }).code === "P2002"
      ) {
        throw new AppError(
          409,
          "This comment is already promoted in this scope",
        );
      }
      throw error;
    }
  }

  private async deletePin(
    scopeUnitId: string,
    commentUnitId: string,
    kind: PinKindEnum,
  ): Promise<void> {
    const existing = await prisma.commentPromotion.findUnique({
      where: {
        scopeUnitId_commentUnitId: {
          scopeUnitId,
          commentUnitId: commentUnitId,
        },
      },
      select: { kind: true },
    });
    if (!existing || existing.kind !== kind) {
      throw new AppError(404, "Promotion not found for this comment and scope");
    }
    await prisma.commentPromotion.delete({
      where: {
        scopeUnitId_commentUnitId: {
          scopeUnitId,
          commentUnitId: commentUnitId,
        },
      },
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
