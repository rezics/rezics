import type {
  AcceptAnswerInput,
  CommentPromotionDTO,
  CreatePostInput,
  EditorialPatchSubmission,
  PinCommentInput,
  PostListQuery,
  RezicsSessionClaims,
  SubmitPostToRealmInput,
  UpdatePostInput,
} from "@rezics/contract";
import {
  allBucketSlugs,
  BasicAdminPermission,
  extractPollUnitIdsFromContentDoc,
  extractUnitRefIdsFromContentDoc,
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
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  lt,
  ne,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { blockService } from "@/block/block.service";
import { resolveRezicsWikiUserId } from "@/infra/infra-users";
import { serverJobProducer } from "@/job/job-boundary";
import { generateBetween } from "@/shelf/fractional-index";
import {
  assertCanEditCollaborativeMetadata,
  collectPatchLeafPaths,
  writeEditorialMetadataHistory,
} from "@/unit/collaborative-metadata";
import {
  primarySupportLanguageCreate,
  resolveEffectiveReadLanguageCandidates,
} from "@/unit/language-resolution";
import {
  hydrateUnitOwnerUserSlugRow,
  hydrateUnitOwnerUserSlugs,
} from "@/utils/userSlugHydration";
import {
  Comment,
  CommentPromotion,
  ContentTranslation,
  ModerationCase,
  Poll,
  Post,
  PostPollReference,
  PostUnitReference,
  Realm,
  RealmMember,
  RealmRuleAcknowledgement,
  ScoreEntry,
  Unit,
  UnitRealm,
  UnitSupportLanguage,
  UnitTag,
  UnitTranslation,
  User,
} from "../db/schema";
import { moderationActionService } from "../governance/moderation-action.service";
import { AppError } from "../utils/errors";
import { mapCommentPromotionToDTO } from "./post.mapper";
import type { PostWithRelations } from "./types";

const PinKindEnum = {
  ACCEPTED_ANSWER: "ACCEPTED_ANSWER",
  PINNED: "PINNED",
  HIGHLIGHT: "HIGHLIGHT",
} as const;

const PostKindEnum = {
  REVIEW: "REVIEW",
  EXCERPT: "EXCERPT",
  REMARK: "REMARK",
  POST: "POST",
  CHAPTER: "CHAPTER",
  WIKI: "WIKI",
} as const;

type DbLike = any;
type PostKindValue = (typeof PostKindEnum)[keyof typeof PostKindEnum];
type PinKindValue = (typeof PinKindEnum)[keyof typeof PinKindEnum];

async function getServerDb(): Promise<DbLike> {
  const { db } = await import("../db/client");
  return db;
}

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

function readRealmRuleUnitId(extra: unknown | null): string | null {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return null;
  const rule = (extra as Record<string, unknown>).rule;
  return typeof rule === "string" && rule.length > 0 ? rule : null;
}

/** Read the snapshotted governing-schema tag slug from a post's `extra`. */
function readStateSchemaTag(extra: unknown | null): string | null {
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
  conditions: SQL[],
  query: { state?: string; stateBucket?: "active" | "closed" },
) {
  if (query.state) {
    conditions.push(eq(Post.state, query.state));
  } else if (query.stateBucket) {
    conditions.push(inArray(Post.state, allBucketSlugs(query.stateBucket)));
  }
}

type UnitRealmModerationStatus = "PENDING" | "APPROVED";

function toUnitRealmModerationStatus(
  state: PostListQuery["realmModerationStatus"],
) {
  if (!state || state === "all") return undefined;
  return state.toUpperCase() as "PENDING" | "APPROVED" | "REMOVED";
}

function wikiContentTranslationStatus(isDraft: boolean) {
  return isDraft ? "DRAFT" : "PUBLISHED";
}

function postContentTranslationStatus(isDraft: boolean) {
  return wikiContentTranslationStatus(isDraft);
}

function sanitizePostExtraForCreate(
  extra: unknown | undefined | null,
): unknown | undefined | null {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) {
    return extra;
  }
  const {
    title: _legacyTitle,
    poll: _legacyPoll,
    ...rest
  } = extra as Record<string, unknown>;
  return rest;
}

function assertExplicitLocalizedWriteLanguage(input: UpdatePostInput): string {
  const touchesLocalizedFields =
    input.title !== undefined || input.content !== undefined;
  if (!touchesLocalizedFields) return input.language ?? "";
  if (!input.language) {
    throw new AppError(400, "Post title/content updates require language");
  }
  return input.language;
}

type PostPollReferenceTx = DbLike;
type PostUnitReferenceTx = DbLike;

function uniqueValues<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function whereAnd(conditions: SQL[]): SQL | undefined {
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function sqlInList(values: readonly string[]): SQL {
  return sql`(${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )})`;
}

function publicUnitConditions(): SQL[] {
  return [
    eq(Unit.status, "PUBLISHED"),
    eq(Unit.visibility, "PUBLIC"),
    eq(Unit.moderationStatus, "APPROVED"),
  ];
}

function cursorCreatedAt(cursor: PostListQuery["cursor"]): Date | null {
  if (!cursor?.createdAt) return null;
  const date = new Date(cursor.createdAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function chronologicalCursorCondition(
  cursor: PostListQuery["cursor"],
  order: "asc" | "desc",
): SQL | undefined {
  const createdAt = cursorCreatedAt(cursor);
  if (!cursor?.unitId || !createdAt) return undefined;

  return order === "asc"
    ? or(
        gt(Post.createdAt, createdAt),
        and(eq(Post.createdAt, createdAt), gt(Post.unitId, cursor.unitId)),
      )
    : or(
        lt(Post.createdAt, createdAt),
        and(eq(Post.createdAt, createdAt), lt(Post.unitId, cursor.unitId)),
      );
}

function rankedCursorCondition(
  cursor: PostListQuery["cursor"],
  scoreExpr: SQL,
): SQL | undefined {
  const createdAt = cursorCreatedAt(cursor);
  const sortValue = Number(cursor?.sortValue);
  if (!cursor?.unitId || !createdAt || !Number.isFinite(sortValue)) {
    return undefined;
  }

  return or(
    sql`${scoreExpr} < ${sortValue}`,
    and(
      sql`${scoreExpr} = ${sortValue}`,
      or(
        lt(Post.createdAt, createdAt),
        and(eq(Post.createdAt, createdAt), lt(Post.unitId, cursor.unitId)),
      ),
    ),
  );
}

function preferredLanguageCondition(
  languageMode: PostListQuery["languageMode"],
  readLanguages: readonly string[],
): SQL | undefined {
  if (languageMode !== "preferred" || readLanguages.length === 0) {
    return undefined;
  }
  return or(
    eq(Unit.isLanguageNeutral, true),
    sql`exists (
      select 1 from "UnitSupportLanguage" usl
      where usl."unitId" = ${Unit.id}
        and usl."language" in ${sqlInList(readLanguages)}
    )`,
  );
}

async function hydratePostsByUnitIds(
  unitIds: readonly string[],
  dbLike?: DbLike,
): Promise<PostWithRelations[]> {
  if (unitIds.length === 0) return [];
  const ids = uniqueValues(unitIds);
  const db = dbLike ?? (await getServerDb());
  const [posts, units, translations, contentTranslations, supportLanguages] =
    (await Promise.all([
      db.select().from(Post).where(inArray(Post.unitId, ids)),
      db.select().from(Unit).where(inArray(Unit.id, ids)),
      db
        .select()
        .from(UnitTranslation)
        .where(inArray(UnitTranslation.unitId, ids)),
      db
        .select()
        .from(ContentTranslation)
        .where(inArray(ContentTranslation.unitId, ids)),
      db
        .select()
        .from(UnitSupportLanguage)
        .where(inArray(UnitSupportLanguage.unitId, ids))
        .orderBy(asc(UnitSupportLanguage.sortOrder)),
    ])) as [any[], any[], any[], any[], any[]];
  const userIds = uniqueValues(
    units
      .map((unit: any) => unit.userId)
      .filter((id: string | null): id is string => !!id),
  );
  const [users, inRealms] = (await Promise.all([
    userIds.length > 0
      ? db.select().from(User).where(inArray(User.unitId, userIds))
      : [],
    db
      .select({ unitId: UnitRealm.unitId, realmUnitId: UnitRealm.realmUnitId })
      .from(UnitRealm)
      .where(
        and(
          inArray(UnitRealm.unitId, ids),
          eq(UnitRealm.moderationStatus, "APPROVED"),
        ),
      ),
  ])) as [any[], any[]];
  const postByUnitId = new Map(posts.map((post: any) => [post.unitId, post]));
  const unitById = new Map(units.map((unit: any) => [unit.id, unit]));
  const userById = new Map(users.map((user: any) => [user.unitId, user]));
  const translationsByUnitId = groupRows(translations, "unitId");
  const contentTranslationsByUnitId = groupRows(contentTranslations, "unitId");
  const supportLanguagesByUnitId = groupRows(supportLanguages, "unitId");
  const inRealmsByUnitId = groupRows(inRealms, "unitId");

  return unitIds.flatMap((unitId) => {
    const post = postByUnitId.get(unitId);
    const unit = unitById.get(unitId);
    if (!post || !unit) return [];
    return [
      {
        ...post,
        unit: {
          ...unit,
          user: unit.userId ? (userById.get(unit.userId) ?? null) : null,
          translations: translationsByUnitId.get(unitId) ?? [],
          contentTranslations: contentTranslationsByUnitId.get(unitId) ?? [],
          supportLanguages: supportLanguagesByUnitId.get(unitId) ?? [],
          inRealms: (inRealmsByUnitId.get(unitId) ?? []).map((row: any) => ({
            realmUnitId: row.realmUnitId,
          })),
        },
      } as PostWithRelations,
    ];
  });
}

function groupRows<T extends Record<string, any>>(
  rows: T[],
  key: keyof T,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const value = row[key];
    if (typeof value !== "string") continue;
    const existing = grouped.get(value);
    if (existing) existing.push(row);
    else grouped.set(value, [row]);
  }
  return grouped;
}

function contentTranslationContentsAfterWrite(
  translations: Array<{ language?: string | null; content?: unknown }>,
  input: { language: string; content: unknown },
): unknown[] {
  let replaced = false;
  const contents = translations.map((translation) => {
    if (translation.language !== input.language) return translation.content;
    replaced = true;
    return input.content;
  });
  if (!replaced) contents.push(input.content);
  return contents;
}

async function getPostByUnitId(
  unitId: string,
  dbLike?: DbLike,
): Promise<PostWithRelations | null> {
  const [post] = await hydratePostsByUnitIds([unitId], dbLike);
  return post ?? null;
}

async function updatePostRow(
  tx: DbLike,
  unitId: string,
  data: Partial<typeof Post.$inferInsert>,
): Promise<PostWithRelations> {
  await tx
    .update(Post)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(Post.unitId, unitId));
  const row = await getPostByUnitId(unitId, tx);
  if (!row) throw new AppError(404, `Post not found: ${unitId}`);
  return row;
}

async function syncPostPollReferences(
  tx: PostPollReferenceTx,
  input: {
    postUnitId: string;
    oldContent: unknown;
    newContent: unknown;
  },
) {
  const oldPollIds = new Set(
    extractPollUnitIdsFromContentDoc(input.oldContent),
  );
  const newPollIds = new Set(
    extractPollUnitIdsFromContentDoc(input.newContent),
  );
  const addedPollIds = [...newPollIds].filter((id) => !oldPollIds.has(id));
  const removedPollIds = [...oldPollIds].filter((id) => !newPollIds.has(id));

  if (addedPollIds.length > 0) {
    await tx
      .insert(PostPollReference)
      .values(
        addedPollIds.map((pollUnitId) => ({
          postUnitId: input.postUnitId,
          pollUnitId,
        })),
      )
      .onConflictDoNothing();
    await tx
      .update(Poll)
      .set({ usageCount: sql`${Poll.usageCount} + 1` })
      .where(inArray(Poll.unitId, addedPollIds));
  }

  if (removedPollIds.length > 0) {
    await tx
      .delete(PostPollReference)
      .where(
        and(
          eq(PostPollReference.postUnitId, input.postUnitId),
          inArray(PostPollReference.pollUnitId, removedPollIds),
        ),
      );
    await tx
      .update(Poll)
      .set({ usageCount: sql`${Poll.usageCount} - 1` })
      .where(and(inArray(Poll.unitId, removedPollIds), gt(Poll.usageCount, 0)));
  }
}

async function syncPostUnitReferences(
  tx: PostUnitReferenceTx,
  input: {
    postUnitId: string;
    oldContents: readonly unknown[];
    newContents: readonly unknown[];
  },
) {
  const oldTargetIds = new Set(
    input.oldContents.flatMap((content) =>
      extractUnitRefIdsFromContentDoc(content),
    ),
  );
  const newTargetIds = new Set(
    input.newContents.flatMap((content) =>
      extractUnitRefIdsFromContentDoc(content),
    ),
  );
  oldTargetIds.delete(input.postUnitId);
  newTargetIds.delete(input.postUnitId);

  const addedTargetIds = [...newTargetIds].filter(
    (id) => !oldTargetIds.has(id),
  );
  const removedTargetIds = [...oldTargetIds].filter(
    (id) => !newTargetIds.has(id),
  );

  if (addedTargetIds.length > 0) {
    await tx
      .insert(PostUnitReference)
      .values(
        addedTargetIds.map((targetUnitId) => ({
          sourcePostUnitId: input.postUnitId,
          targetUnitId,
        })),
      )
      .onConflictDoNothing();
    await tx
      .update(Unit)
      .set({ referenceCount: sql`${Unit.referenceCount} + 1` })
      .where(inArray(Unit.id, addedTargetIds));
  }

  if (removedTargetIds.length > 0) {
    await tx
      .delete(PostUnitReference)
      .where(
        and(
          eq(PostUnitReference.sourcePostUnitId, input.postUnitId),
          inArray(PostUnitReference.targetUnitId, removedTargetIds),
        ),
      );
    await tx
      .update(Unit)
      .set({ referenceCount: sql`${Unit.referenceCount} - 1` })
      .where(
        and(inArray(Unit.id, removedTargetIds), gt(Unit.referenceCount, 0)),
      );
  }
}

async function clearPostUnitReferences(
  tx: PostUnitReferenceTx,
  postUnitId: string,
) {
  const rows = await tx
    .select({ targetUnitId: PostUnitReference.targetUnitId })
    .from(PostUnitReference)
    .where(eq(PostUnitReference.sourcePostUnitId, postUnitId));
  const targetIds = rows
    .map((row: { targetUnitId: unknown }) => row.targetUnitId)
    .filter((id: unknown): id is string => typeof id === "string");
  if (targetIds.length === 0) return;

  await tx
    .delete(PostUnitReference)
    .where(eq(PostUnitReference.sourcePostUnitId, postUnitId));
  await tx
    .update(Unit)
    .set({ referenceCount: sql`${Unit.referenceCount} - 1` })
    .where(and(inArray(Unit.id, targetIds), gt(Unit.referenceCount, 0)));
}

async function upsertPostContentTranslation(
  tx: DbLike,
  input: {
    unitId: string;
    language: string;
    content: unknown;
    actorUserId: string;
    status: "DRAFT" | "PUBLISHED";
  },
) {
  await tx
    .insert(ContentTranslation)
    .values({
      unitId: input.unitId,
      language: input.language,
      content: input.content,
      status: input.status,
      authorUserId: input.actorUserId,
      provenance: { source: "post-content" },
    })
    .onConflictDoUpdate({
      target: [ContentTranslation.unitId, ContentTranslation.language],
      set: {
        content: input.content,
        status: input.status,
        authorUserId: input.actorUserId,
        provenance: { source: "post-content" },
        updatedAt: new Date(),
      },
    });
  await ensurePostSupportLanguage(tx, input);
}

async function ensurePostSupportLanguage(
  tx: DbLike,
  input: {
    unitId: string;
    language: string;
  },
) {
  await tx
    .insert(UnitSupportLanguage)
    .values({
      unitId: input.unitId,
      language: input.language,
      isPrimary: false,
    })
    .onConflictDoNothing();
}

async function upsertPostTitleTranslation(
  tx: DbLike,
  input: {
    unitId: string;
    language: string;
    title: string;
  },
) {
  await tx
    .insert(UnitTranslation)
    .values({
      unitId: input.unitId,
      language: input.language,
      title: input.title,
    })
    .onConflictDoUpdate({
      target: [UnitTranslation.unitId, UnitTranslation.language],
      set: {
        title: input.title,
        updatedAt: new Date(),
      },
    });
  await ensurePostSupportLanguage(tx, input);
}

async function applyBlockedAuthorFilter(
  conditions: SQL[],
  options?: { isAdmin?: boolean; viewerUserId?: string | null },
) {
  if (options?.isAdmin || !options?.viewerUserId) return;

  const blockedIds = await blockService.blockedUserIds(options.viewerUserId);
  if (blockedIds.length === 0) return;
  conditions.push(notInArray(Post.authorUserId, blockedIds));
}

/** Realm roles that may pin/accept within a realm's threads. */
const PROMOTION_ROLES = ["owner", "admin", "moderator"] as const;

/**
 * Attach the promotion overlay (`pinKind`/`pinPosition`) to thread rows. A
 * comment is promoted at most once per scope and its scope is always its own
 * thread root, so the target comment unit maps to at most one promotion row.
 */
async function attachPinKinds<
  T extends {
    unitId: string;
    pinKind?: PinKindValue | null;
    pinPosition?: string | null;
  },
>(posts: T[]): Promise<T[]> {
  if (posts.length === 0) return posts;
  const db = await getServerDb();
  const pins = (await db
    .select({
      commentId: CommentPromotion.commentId,
      kind: CommentPromotion.kind,
      position: CommentPromotion.position,
    })
    .from(CommentPromotion)
    .where(
      inArray(
        CommentPromotion.commentId,
        posts.map((post) => post.unitId),
      ),
    )) as Array<{
    commentId: string;
    kind: PinKindValue;
    position: string;
  }>;
  const pinByCommentId = new Map(pins.map((pin) => [pin.commentId, pin]));
  for (const post of posts) {
    const pin = pinByCommentId.get(post.unitId);
    post.pinKind = pin?.kind ?? null;
    post.pinPosition = pin?.position ?? null;
  }
  return posts;
}

export class PostService {
  private async initialUnitRealmModerationStatuses(
    tx: DbLike,
    realmUnitIds: string[],
  ): Promise<Map<string, UnitRealmModerationStatus>> {
    if (realmUnitIds.length === 0) return new Map();
    const realms = (await tx
      .select({
        unitId: Realm.unitId,
        contentRequiresApproval: Realm.contentRequiresApproval,
      })
      .from(Realm)
      .where(inArray(Realm.unitId, realmUnitIds))) as Array<{
      unitId: string;
      contentRequiresApproval: boolean;
    }>;
    return new Map(
      realms.map((realm) => [
        realm.unitId,
        realm.contentRequiresApproval ? "PENDING" : "APPROVED",
      ]),
    );
  }

  private async createPendingRealmReviewCase(
    tx: DbLike,
    input: {
      realmUnitId: string;
      unitId: string;
      actorUserId: string;
    },
  ) {
    const [created] = await tx
      .insert(ModerationCase)
      .values({
        scope: "REALM",
        realmUnitId: input.realmUnitId,
        state: "NEW",
        reporterUserId: input.actorUserId,
        subjectUserId: input.actorUserId,
        targetKind: "UNIT_REALM",
        targetId: input.unitId,
        addressedUnitId: input.unitId,
        reason: "Content submitted for realm approval",
        metadata: { relationModeration: true },
      })
      .returning();
    if (!created) throw new Error("Failed to create moderation case");
    await moderationActionService.appendModerationAction(tx, {
      authority: "REALM",
      realmUnitId: input.realmUnitId,
      targetKind: "UNIT_REALM",
      targetId: input.unitId,
      actionKind: "NOTE",
      actorKind: "USER",
      actorUserId: input.actorUserId,
      reasonCode: "realm.submission.pending_review",
      reasonText: created.reason,
      resultingStatus: "PENDING",
      caseId: created.id,
    });
  }

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

    const conditions: SQL[] = [];
    if (!options?.isAdmin) conditions.push(...publicUnitConditions());
    if (query.targetUnitId)
      conditions.push(eq(Unit.targetUnitId, query.targetUnitId));
    const readLanguages = resolveEffectiveReadLanguageCandidates({
      languages: (query as { languages?: string | readonly string[] })
        .languages,
    });
    const languageVisibility = preferredLanguageCondition(
      query.languageMode,
      readLanguages,
    );
    if (languageVisibility) conditions.push(languageVisibility);
    // Weak context lookup only: do not resolve through Unit.targetUnitId and do
    // not validate that the value names a VARIANT.
    if (query.variantUnitId)
      conditions.push(eq(Post.variantUnitId, query.variantUnitId));
    if (query.authorUserId)
      conditions.push(eq(Post.authorUserId, query.authorUserId));
    if (query.kind) conditions.push(eq(Post.kind, query.kind));
    applyStateFilter(conditions, query);

    const idList = parseIdsCsv(query.ids);
    if (idList && idList.length > 0) {
      conditions.push(inArray(Post.unitId, idList));
    }

    await applyBlockedAuthorFilter(conditions, options);

    const db = await getServerDb();
    const where = whereAnd(conditions);
    const sortOrder =
      typeof query.sort === "object" &&
      (query.sort.order === "asc" || query.sort.order === "desc")
        ? query.sort.order
        : "desc";
    const cursorCondition = chronologicalCursorCondition(
      query.cursor,
      sortOrder,
    );
    if (cursorCondition) conditions.push(cursorCondition);
    const finalWhere = whereAnd(conditions);
    const [rows, totalRows] = await Promise.all([
      db
        .select({ unitId: Post.unitId })
        .from(Post)
        .innerJoin(Unit, eq(Unit.id, Post.unitId))
        .where(finalWhere)
        .orderBy(
          sortOrder === "asc" ? asc(Post.createdAt) : desc(Post.createdAt),
          sortOrder === "asc" ? asc(Post.unitId) : desc(Post.unitId),
        )
        .offset(cursorCondition ? 0 : skipNum)
        .limit(limitNum),
      db
        .select({ total: count() })
        .from(Post)
        .innerJoin(Unit, eq(Unit.id, Post.unitId))
        .where(where),
    ]);
    const posts = await hydratePostsByUnitIds(
      rows.map((row: { unitId: string }) => row.unitId),
      db,
    );

    return {
      posts: await hydrateUnitOwnerUserSlugs(await attachPinKinds(posts)),
      total: Number(totalRows[0]?.total ?? 0),
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
    const moderationStatus = toUnitRealmModerationStatus(
      opts.realmModerationStatus,
    );
    const readLanguages = resolveEffectiveReadLanguageCandidates({
      languages: (opts as { languages?: string | readonly string[] }).languages,
    });
    const languageVisibility = preferredLanguageCondition(
      opts.languageMode,
      readLanguages,
    );

    if (!(await this.canReadRealmFeed(realmUnitId, options))) {
      return { posts: [], total: 0 };
    }

    const conditions: SQL[] = [eq(UnitRealm.realmUnitId, realmUnitId)];
    if (!options?.isAdmin) {
      conditions.push(...publicUnitConditions());
      conditions.push(eq(UnitRealm.moderationStatus, "APPROVED"));
    } else if (moderationStatus) {
      conditions.push(eq(UnitRealm.moderationStatus, moderationStatus));
    }
    if (languageVisibility) conditions.push(languageVisibility);
    if (tagIds.length > 0) {
      const tagCondition = or(
        sql`exists (
            select 1 from "RealmTagApplication" rta
            where rta."realmUnitId" = ${realmUnitId}
              and rta."unitId" = ${Post.unitId}
              and rta."tagUnitId" in ${sqlInList(tagIds)}
          )`,
        sql`(
            not exists (
              select 1 from "RealmTagApplication" rta_any
              where rta_any."realmUnitId" = ${realmUnitId}
                and rta_any."unitId" = ${Post.unitId}
            )
            and exists (
              select 1 from "UnitTag" ut
              where ut."unitId" = ${Post.unitId}
                and ut."tagUnitId" in ${sqlInList(tagIds)}
            )
          )`,
      );
      if (tagCondition) conditions.push(tagCondition);
    }

    if (opts.authorUserId)
      conditions.push(eq(Post.authorUserId, opts.authorUserId));
    if (opts.kind) conditions.push(eq(Post.kind, opts.kind));
    applyStateFilter(conditions, opts);

    await applyBlockedAuthorFilter(conditions, options);

    const idList = parseIdsCsv(opts.ids);
    if (idList && idList.length > 0) {
      conditions.push(inArray(Post.unitId, idList));
    }

    if (sort === "hot") {
      // Phase-1 approximation from design.md Decision 5: rank as top posts
      // within the last 7 days instead of the full decay formula.
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      conditions.push(gt(Post.createdAt, since));
    }

    const db = await getServerDb();
    const scoreExpr = sql<number>`coalesce(${ScoreEntry.value}, 0)`;
    const countWhere = whereAnd(conditions);
    if (sort === "top" || sort === "hot") {
      const cursorCondition = rankedCursorCondition(opts.cursor, scoreExpr);
      if (cursorCondition) conditions.push(cursorCondition);
    } else {
      const cursorCondition = chronologicalCursorCondition(opts.cursor, "desc");
      if (cursorCondition) conditions.push(cursorCondition);
    }
    const where = whereAnd(conditions);
    let rowQuery = db
      .select({
        unitId: Post.unitId,
        sortValue:
          sort === "top" || sort === "hot" ? scoreExpr : sql<number>`0`,
      })
      .from(Post)
      .innerJoin(Unit, eq(Unit.id, Post.unitId))
      .innerJoin(UnitRealm, eq(UnitRealm.unitId, Post.unitId));
    if (sort === "top" || sort === "hot") {
      rowQuery = rowQuery.leftJoin(
        ScoreEntry,
        eq(ScoreEntry.id, Post.scoreEntryId),
      );
    }
    const orderedRowQuery = rowQuery
      .where(where)
      .orderBy(
        sort === "top" || sort === "hot"
          ? desc(scoreExpr)
          : desc(Post.createdAt),
        desc(Post.createdAt),
        desc(Post.unitId),
      )
      .offset(opts.cursor ? 0 : skipNum)
      .limit(limitNum);

    const [rows, totalRows] = await Promise.all([
      orderedRowQuery,
      db
        .select({ total: count() })
        .from(Post)
        .innerJoin(Unit, eq(Unit.id, Post.unitId))
        .innerJoin(UnitRealm, eq(UnitRealm.unitId, Post.unitId))
        .where(countWhere),
    ]);
    const sortValues = new Map<string, number | string | null>();
    for (const row of rows as Array<{ unitId: string; sortValue?: unknown }>) {
      sortValues.set(
        row.unitId,
        typeof row.sortValue === "number" || typeof row.sortValue === "string"
          ? row.sortValue
          : null,
      );
    }
    const posts = (
      await hydratePostsByUnitIds(
        rows.map((row: { unitId: string }) => row.unitId),
        db,
      )
    ).map((post) => ({
      ...post,
      feedSortValue: sortValues.get(post.unitId) ?? null,
    }));

    return {
      posts: await hydrateUnitOwnerUserSlugs(await attachPinKinds(posts)),
      total: Number(totalRows[0]?.total ?? 0),
    };
  }

  private async canReadRealmFeed(
    realmUnitId: string,
    options?: { isAdmin?: boolean; viewerUserId?: string | null },
  ): Promise<boolean> {
    if (options?.isAdmin) return true;

    const db = await getServerDb();
    const [realm] = await db
      .select({
        isPublic: Realm.isPublic,
        userId: Unit.userId,
      })
      .from(Realm)
      .innerJoin(Unit, eq(Unit.id, Realm.unitId))
      .where(eq(Realm.unitId, realmUnitId))
      .limit(1);
    if (!realm) return false;
    if (realm.isPublic) return true;
    if (realm.userId && realm.userId === options?.viewerUserId) {
      return true;
    }

    const memberState = options?.viewerUserId
      ? (
          await db
            .select({ state: RealmMember.state })
            .from(RealmMember)
            .where(
              and(
                eq(RealmMember.realmUnitId, realmUnitId),
                eq(RealmMember.userId, options.viewerUserId),
              ),
            )
            .limit(1)
        )[0]?.state
      : undefined;
    return memberState === "ACTIVE" || memberState === "MUTED";
  }

  /** Get a single post by unit ID. */
  async getByUnitId(
    unitId: string,
    options?: { isAdmin?: boolean; allowTombstone?: boolean },
  ): Promise<PostWithRelations> {
    const post = await getPostByUnitId(unitId);
    if (!post) {
      throw new AppError(404, `Post not found: ${unitId}`);
    }
    if (
      !options?.isAdmin &&
      !options?.allowTombstone &&
      (post.unit.status !== "PUBLISHED" || post.unit.visibility !== "PUBLIC")
    ) {
      throw new AppError(404, `Post not found: ${unitId}`);
    }
    const withPins = await attachPinKinds([post as PostWithRelations]);
    const withPin = withPins[0];
    if (!withPin) throw new AppError(404, `Post not found: ${unitId}`);
    return hydrateUnitOwnerUserSlugRow(withPin);
  }

  private async assertRealmPostAllowed(
    realmUnitIds: string[],
    userId: string,
  ): Promise<void> {
    if (realmUnitIds.length === 0) return;
    const db = await getServerDb();

    const [realms, memberships, acknowledgements] = (await Promise.all([
      db
        .select({
          unitId: Realm.unitId,
          extra: Realm.extra,
          ruleVersion: Realm.ruleVersion,
          ruleRequireOnPost: Realm.ruleRequireOnPost,
        })
        .from(Realm)
        .where(inArray(Realm.unitId, realmUnitIds)),
      db
        .select({
          realmUnitId: RealmMember.realmUnitId,
          state: RealmMember.state,
        })
        .from(RealmMember)
        .where(
          and(
            inArray(RealmMember.realmUnitId, realmUnitIds),
            eq(RealmMember.userId, userId),
          ),
        ),
      db
        .select({
          realmUnitId: RealmRuleAcknowledgement.realmUnitId,
          ruleUnitId: RealmRuleAcknowledgement.ruleUnitId,
          version: RealmRuleAcknowledgement.version,
        })
        .from(RealmRuleAcknowledgement)
        .where(
          and(
            inArray(RealmRuleAcknowledgement.realmUnitId, realmUnitIds),
            eq(RealmRuleAcknowledgement.userId, userId),
          ),
        ),
    ])) as [
      Array<{
        unitId: string;
        extra: unknown;
        ruleVersion: number;
        ruleRequireOnPost: boolean;
      }>,
      Array<{ realmUnitId: string; state: string }>,
      Array<{ realmUnitId: string; ruleUnitId: string; version: number }>,
    ];

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
      title,
      scoreEntryId,
      extra,
      variantUnitId,
    } = input;

    // Chapters always publish. A draft is owner-only and stays out of
    // feeds/search until published (see publication-policy
    // `publicUnitEligibilityWhere`).
    const asDraft = input.status === "DRAFT" && kind !== PostKindEnum.CHAPTER;
    const targetUnitId =
      typeof inputTargetUnitId === "string" && inputTargetUnitId.trim()
        ? inputTargetUnitId.trim()
        : null;
    const realmIdsToWrite = [...new Set(realmUnitIds ?? [])];
    const tagIdsToWrite = [...new Set(tagIds ?? [])];

    if (kind === PostKindEnum.CHAPTER) {
      if (!targetUnitId) {
        throw new Error(
          "Post(kind=CHAPTER) requires targetUnitId pointing to a Unit(type=BOOK)",
        );
      }
      const db = await getServerDb();
      const [target] = await db
        .select({ type: Unit.type })
        .from(Unit)
        .where(eq(Unit.id, targetUnitId))
        .limit(1);
      if (!target || target.type !== "BOOK") {
        throw new Error(
          `Post(kind=CHAPTER) targetUnitId must reference a Unit(type=BOOK); got ${target?.type ?? "missing"}`,
        );
      }
    }

    await this.assertRealmPostAllowed(realmIdsToWrite, authorUserId);

    const db = await getServerDb();
    const post = await db.transaction(async (tx: DbLike) => {
      const ownerUserId =
        kind === "WIKI" ? await resolveRezicsWikiUserId() : authorUserId;
      const postLanguage = input.language;
      const [unit] = await tx
        .insert(Unit)
        .values({
          userId: ownerUserId,
          slugScope: ownerUserId,
          type: "POST",
          targetUnitId,
          status: asDraft ? "DRAFT" : "PUBLISHED",
          publishedAt: asDraft ? null : new Date(),
        })
        .returning();
      if (!unit) throw new Error("Failed to create post unit");
      const primaryLanguage = primarySupportLanguageCreate(postLanguage);
      await tx.insert(UnitSupportLanguage).values({
        unitId: unit.id,
        ...primaryLanguage,
      });

      // Validate the requested tags once (selecting slug), rejecting unknown
      // ids, and derive the lifecycle initialization from the same rows: a
      // stateful tag snapshots its slug into `extra.stateSchemaTag` and seeds
      // `state` to the schema's initial value. At most one stateful tag.
      let statefulInit: { tagSlug: string; initial: string } | null = null;
      if (tagIdsToWrite.length > 0) {
        const validTags = (await tx
          .select({ id: Unit.id, slug: Unit.slug })
          .from(Unit)
          .where(
            and(
              inArray(Unit.id, tagIdsToWrite),
              eq(Unit.type, "TAG"),
              ne(Unit.status, "DELETED"),
            ),
          )) as Array<{ id: string; slug: string | null }>;
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
      const extraWithoutLegacyTitle = sanitizePostExtraForCreate(extra);
      const extraToWrite = statefulInit
        ? {
            ...(extraWithoutLegacyTitle &&
            typeof extraWithoutLegacyTitle === "object" &&
            !Array.isArray(extraWithoutLegacyTitle)
              ? (extraWithoutLegacyTitle as Record<string, unknown>)
              : {}),
            stateSchemaTag: statefulInit.tagSlug,
          }
        : extraWithoutLegacyTitle;
      const titleToWrite = title.trim();

      const createData = {
        unitId: unit.id,
        authorUserId,
        kind: (kind as PostKindValue) ?? null,
        scoreEntryId: scoreEntryId ?? null,
        variantUnitId: variantUnitId ?? null,
        state: statefulInit?.initial ?? null,
        extra: extraToWrite ?? null,
      };

      const [created] = await tx.insert(Post).values(createData).returning();
      if (!created) throw new Error("Failed to create post");

      if (realmIdsToWrite.length > 0) {
        const createdAt = new Date();
        const initialStatuses = await this.initialUnitRealmModerationStatuses(
          tx,
          realmIdsToWrite,
        );
        await Promise.all(
          realmIdsToWrite.map(async (realmUnitId) => {
            const moderationStatus =
              initialStatuses.get(realmUnitId) ?? "APPROVED";
            await tx.insert(UnitRealm).values({
              realmUnitId,
              unitId: created.unitId,
              moderationStatus,
              isLocked: false,
              createdAt,
            });
            if (moderationStatus === "PENDING") {
              await this.createPendingRealmReviewCase(tx, {
                realmUnitId,
                unitId: created.unitId,
                actorUserId: authorUserId,
              });
            }
          }),
        );
      }

      if (tagIdsToWrite.length > 0) {
        // Tags were validated above (before the post insert); just write the
        // UnitTag junction rows here.
        await Promise.all(
          tagIdsToWrite.map((tagUnitId) =>
            tx.insert(UnitTag).values({
              unitId: created.unitId,
              tagUnitId,
            }),
          ),
        );
      }

      if (titleToWrite) {
        await upsertPostTitleTranslation(tx, {
          unitId: created.unitId,
          language: postLanguage,
          title: titleToWrite,
        });
      }
      await upsertPostContentTranslation(tx, {
        unitId: created.unitId,
        language: postLanguage,
        content,
        actorUserId: authorUserId,
        status: postContentTranslationStatus(asDraft),
      });
      await syncPostPollReferences(tx, {
        postUnitId: created.unitId,
        oldContent: null,
        newContent: content,
      });
      await syncPostUnitReferences(tx, {
        postUnitId: created.unitId,
        oldContents: [],
        newContents: [content],
      });

      if (kind === "WIKI") {
        await writeEditorialMetadataHistory(tx as any, {
          unitId: created.unitId,
          actorUserId: authorUserId,
          patch: wikiPostContentHistoryPatch(content),
          message: "wiki-post.create",
        });
      }

      const hydrated = await getPostByUnitId(created.unitId, tx);
      if (!hydrated) throw new Error("Failed to hydrate created post");
      return hydrated;
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
    const db = await getServerDb();
    const existing = await getPostByUnitId(unitId, db);
    if (!existing) throw new AppError(404, `Post not found: ${unitId}`);
    if (existing.authorUserId !== authorUserId) {
      throw new AppError(403, "Only the author can change publication state");
    }
    if (existing.unit.status === "DELETED") {
      throw new AppError(409, "Cannot publish a deleted post");
    }

    await db
      .update(Unit)
      .set({
        status: publish ? "PUBLISHED" : "DRAFT",
        // Preserve the first-publication timestamp; set it on first publish.
        publishedAt: publish
          ? (existing.unit.publishedAt ?? new Date())
          : existing.unit.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(Unit.id, unitId));

    await db
      .update(ContentTranslation)
      .set({
        status: postContentTranslationStatus(!publish),
        updatedAt: new Date(),
      })
      .where(eq(ContentTranslation.unitId, unitId));

    // Re-sync either way: publish indexes; unpublish de-lists (the indexer
    // honours `publicUnitEligibilityWhere`).
    await Promise.all([enqueuePostSync(unitId), enqueueContentSync(unitId)]);

    const updated = await getPostByUnitId(unitId, db);
    if (!updated) throw new AppError(404, `Post not found: ${unitId}`);
    return hydrateUnitOwnerUserSlugRow(updated);
  }

  async submitToRealm(
    unitId: string,
    input: SubmitPostToRealmInput,
    authorUserId: string,
  ): Promise<PostWithRelations> {
    const tagIdsToWrite = [...new Set(input.tagIds ?? [])];
    const db = await getServerDb();
    const existing = await getPostByUnitId(unitId, db);
    if (!existing) throw new AppError(404, `Post not found: ${unitId}`);
    if (existing.authorUserId !== authorUserId) {
      throw new AppError(
        403,
        "Only the author can submit this post to a realm",
      );
    }
    if (existing.unit.status === "DELETED") {
      throw new AppError(409, "Cannot submit a deleted post to a realm");
    }

    await this.assertRealmPostAllowed([input.realmUnitId], authorUserId);

    const updated = await db.transaction(async (tx: DbLike) => {
      const [existingRealmRow] = await tx
        .select({ moderationStatus: UnitRealm.moderationStatus })
        .from(UnitRealm)
        .where(
          and(
            eq(UnitRealm.realmUnitId, input.realmUnitId),
            eq(UnitRealm.unitId, unitId),
          ),
        )
        .limit(1);
      if (existingRealmRow?.moderationStatus === "REMOVED") {
        throw new AppError(
          409,
          "Rejected or removed realm submissions require moderator review",
        );
      }

      if (tagIdsToWrite.length > 0) {
        const validTags = (await tx
          .select({ id: Unit.id })
          .from(Unit)
          .where(
            and(
              inArray(Unit.id, tagIdsToWrite),
              eq(Unit.type, "TAG"),
              ne(Unit.status, "DELETED"),
            ),
          )) as Array<{ id: string }>;
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
      }

      // This is author/member publishing, not realm admin content management.
      // Keep it in the post domain so ownership and post-to-realm policy stay
      // aligned with new realm post creation.
      const initialStatuses = await this.initialUnitRealmModerationStatuses(
        tx,
        [input.realmUnitId],
      );
      const moderationStatus =
        initialStatuses.get(input.realmUnitId) ?? "APPROVED";
      await tx
        .insert(UnitRealm)
        .values({
          realmUnitId: input.realmUnitId,
          unitId,
          moderationStatus,
          isLocked: false,
        })
        .onConflictDoNothing();
      if (!existingRealmRow && moderationStatus === "PENDING") {
        await this.createPendingRealmReviewCase(tx, {
          realmUnitId: input.realmUnitId,
          unitId,
          actorUserId: authorUserId,
        });
      }

      for (const tagUnitId of tagIdsToWrite) {
        await tx
          .insert(UnitTag)
          .values({
            unitId,
            tagUnitId,
          })
          .onConflictDoNothing();
      }

      if (input.publish) {
        await tx
          .update(Unit)
          .set({
            status: "PUBLISHED",
            publishedAt: existing.unit.publishedAt ?? new Date(),
            updatedAt: new Date(),
          })
          .where(eq(Unit.id, unitId));
        await tx
          .update(ContentTranslation)
          .set({
            status: postContentTranslationStatus(false),
            updatedAt: new Date(),
          })
          .where(eq(ContentTranslation.unitId, unitId));
      }

      const post = await getPostByUnitId(unitId, tx);
      if (!post) throw new AppError(404, `Post not found: ${unitId}`);
      return post;
    });

    await Promise.all([enqueuePostSync(unitId), enqueueContentSync(unitId)]);

    return hydrateUnitOwnerUserSlugRow(updated);
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
    const data: Partial<typeof Post.$inferInsert> = {};

    const titleToWrite = input.title?.trim();
    if (input.isLocked !== undefined) data.isLocked = input.isLocked;
    if (input.extra !== undefined) {
      const extra = sanitizePostExtraForCreate(input.extra);
      data.extra = extra === null ? null : extra;
    }

    const db = await getServerDb();
    if (!actor) {
      const updated = await db.transaction(async (tx: DbLike) => {
        const language = assertExplicitLocalizedWriteLanguage(input);
        const existing = await getPostByUnitId(unitId, tx);
        if (!existing) throw new AppError(404, `Post not found: ${unitId}`);
        const oldContent = (existing.unit.contentTranslations ?? []).find(
          (translation) => translation.language === language,
        )?.content;
        const oldContents = (existing.unit.contentTranslations ?? []).map(
          (translation) => translation.content,
        );
        const row =
          Object.keys(data).length > 0
            ? await updatePostRow(tx, unitId, data)
            : existing;
        if (titleToWrite) {
          await upsertPostTitleTranslation(tx, {
            unitId,
            language,
            title: titleToWrite,
          });
        }
        if (input.content !== undefined) {
          await upsertPostContentTranslation(tx, {
            unitId,
            language,
            content: input.content,
            actorUserId: existing.authorUserId,
            status: postContentTranslationStatus(
              existing.unit.status === "DRAFT",
            ),
          });
          await syncPostPollReferences(tx, {
            postUnitId: unitId,
            oldContent,
            newContent: input.content,
          });
          await syncPostUnitReferences(tx, {
            postUnitId: unitId,
            oldContents,
            newContents: contentTranslationContentsAfterWrite(
              existing.unit.contentTranslations ?? [],
              { language, content: input.content },
            ),
          });
        }
        return row;
      });

      const patchFields: Record<string, any> = {};
      if (input.title !== undefined) patchFields.title = input.title;
      if (input.content !== undefined) patchFields.content = input.content;
      if (input.isLocked !== undefined) patchFields.isLocked = input.isLocked;
      if (input.extra !== undefined) patchFields.extra = input.extra;
      await enqueuePostFields(unitId, patchFields);
      if (input.content !== undefined) await enqueueContentSync(unitId);

      return hydrateUnitOwnerUserSlugRow(updated);
    }

    const updated = await db.transaction(async (tx: DbLike) => {
      const language = assertExplicitLocalizedWriteLanguage(input);
      const existing = await getPostByUnitId(unitId, tx);
      if (!existing) throw new AppError(404, `Post not found: ${unitId}`);
      const currentContent = (existing.unit.contentTranslations ?? []).find(
        (translation) => translation.language === language,
      )?.content;
      const currentContents = (existing.unit.contentTranslations ?? []).map(
        (translation) => translation.content,
      );
      const isWikiContentMainEdit =
        existing.kind === "WIKI" &&
        input.content !== undefined &&
        !jsonEquivalent(
          mainMarkdownSource(currentContent),
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

      const row =
        Object.keys(data).length > 0
          ? await updatePostRow(tx, unitId, data)
          : existing;

      if (titleToWrite) {
        await upsertPostTitleTranslation(tx, {
          unitId,
          language,
          title: titleToWrite,
        });
      }
      if (input.content !== undefined) {
        await upsertPostContentTranslation(tx, {
          unitId,
          language,
          content: input.content,
          actorUserId: actor.userId ?? existing.authorUserId,
          status: postContentTranslationStatus(
            existing.unit.status === "DRAFT",
          ),
        });
        await syncPostPollReferences(tx, {
          postUnitId: unitId,
          oldContent: currentContent,
          newContent: input.content,
        });
        await syncPostUnitReferences(tx, {
          postUnitId: unitId,
          oldContents: currentContents,
          newContents: contentTranslationContentsAfterWrite(
            existing.unit.contentTranslations ?? [],
            { language, content: input.content },
          ),
        });
      }

      if (isWikiContentMainEdit && actor) {
        await writeEditorialMetadataHistory(tx as any, {
          unitId,
          actorUserId: actor.userId,
          patch:
            historyInput?.patch ?? wikiPostContentHistoryPatch(input.content),
          message: historyInput?.message ?? "wiki-post.content.update",
          restoreSource: historyInput?.restoreSource,
        });
      }

      return row;
    });

    const patchFields: Record<string, any> = {};
    if (input.title !== undefined) patchFields.title = input.title;
    if (input.content !== undefined) patchFields.content = input.content;
    if (input.isLocked !== undefined) patchFields.isLocked = input.isLocked;
    if (input.extra !== undefined) patchFields.extra = input.extra;
    await enqueuePostFields(unitId, patchFields);
    if (input.content !== undefined) await enqueueContentSync(unitId);

    return hydrateUnitOwnerUserSlugRow(updated);
  }

  /** Delete a root submission. Comment reply counters are owned by Comment. */
  async delete(unitId: string): Promise<void> {
    const db = await getServerDb();
    await db.transaction(async (tx: DbLike) => {
      const existing = await getPostByUnitId(unitId, tx);
      if (!existing) throw new AppError(404, `Post not found: ${unitId}`);

      // Soft-delete: mark the unit as DELETED
      await tx
        .update(Unit)
        .set({ status: "DELETED", updatedAt: new Date() })
        .where(eq(Unit.id, unitId));

      await tx
        .delete(ContentTranslation)
        .where(eq(ContentTranslation.unitId, unitId));
      await clearPostUnitReferences(tx, unitId);
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
    const db = await getServerDb();
    const existing = await getPostByUnitId(unitId, db);
    if (!existing) throw new AppError(404, `Post not found: ${unitId}`);
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

    await db
      .update(Post)
      .set({ state: normalized, updatedAt: new Date() })
      .where(eq(Post.unitId, unitId));
    await enqueuePostFields(unitId, { state: normalized });
    const updated = await getPostByUnitId(unitId, db);
    if (!updated) throw new AppError(404, `Post not found: ${unitId}`);
    return hydrateUnitOwnerUserSlugRow(updated);
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
    const db = await getServerDb();
    const [root] = await db
      .select({ state: Post.state, extra: Post.extra })
      .from(Post)
      .where(eq(Post.unitId, scopeUnitId))
      .limit(1);
    if (!root) return;
    const schemaTag = readStateSchemaTag(root.extra);
    const schema = schemaTag ? getStateSchema(schemaTag) : undefined;
    if (!schema || !isLegalStateValue(schema, "solved")) return;
    if (root.state === schema.initial) {
      await db
        .update(Post)
        .set({ state: "solved", updatedAt: new Date() })
        .where(eq(Post.unitId, scopeUnitId));
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
    const db = await getServerDb();
    const [remainingRow] = await db
      .select({ total: count() })
      .from(CommentPromotion)
      .where(
        and(
          eq(CommentPromotion.scopeUnitId, scopeUnitId),
          eq(CommentPromotion.kind, PinKindEnum.ACCEPTED_ANSWER),
        ),
      );
    const remaining = Number(remainingRow?.total ?? 0);
    if (remaining > 0) return;
    const [root] = await db
      .select({ state: Post.state, extra: Post.extra })
      .from(Post)
      .where(eq(Post.unitId, scopeUnitId))
      .limit(1);
    if (!root) return;
    const schemaTag = readStateSchemaTag(root.extra);
    const schema = schemaTag ? getStateSchema(schemaTag) : undefined;
    if (!schema) return;
    if (root.state === "solved") {
      await db
        .update(Post)
        .set({ state: schema.initial, updatedAt: new Date() })
        .where(eq(Post.unitId, scopeUnitId));
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
    const db = await getServerDb();
    const [tag] = await db
      .select({ id: Unit.id })
      .from(Unit)
      .where(
        and(eq(Unit.type, "TAG"), eq(Unit.slug, OFFICIAL_QUESTION_TAG_SLUG)),
      )
      .limit(1);
    if (!tag) return false;
    const [applied] = await db
      .select({ unitId: UnitTag.unitId })
      .from(UnitTag)
      .where(
        and(eq(UnitTag.unitId, rootPostUnitId), eq(UnitTag.tagUnitId, tag.id)),
      )
      .limit(1);
    return !!applied;
  }

  /** Pin a reply within its thread scope (`kind = PINNED`). */
  async pin(
    input: PinCommentInput,
    caller: RezicsSessionClaims,
  ): Promise<CommentPromotionDTO> {
    await this.assertCanPromoteInThread(input.scopeUnitId, caller);
    await this.loadPromotableTarget(input.scopeUnitId, input.commentId);
    const position = await this.mintPinPosition(
      input.scopeUnitId,
      PinKindEnum.PINNED,
      input.beforeTargetCommentId,
      input.afterTargetCommentId,
    );
    return this.createPin(
      input.scopeUnitId,
      input.commentId,
      PinKindEnum.PINNED,
      position,
      caller.userId,
    );
  }

  /** Remove a `PINNED` promotion. */
  async unpin(
    scopeUnitId: string,
    commentId: string,
    caller: RezicsSessionClaims,
  ): Promise<void> {
    await this.assertCanPromoteInThread(scopeUnitId, caller);
    await this.deletePin(scopeUnitId, commentId, PinKindEnum.PINNED);
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
      input.commentId,
    );
    if (target.depth !== 1 || target.parentCommentId !== null) {
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
      input.beforeTargetCommentId,
      input.afterTargetCommentId,
    );
    const pin = await this.createPin(
      input.scopeUnitId,
      input.commentId,
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
    commentId: string,
    caller: RezicsSessionClaims,
  ): Promise<void> {
    await this.assertCanPromoteInThread(scopeUnitId, caller);
    await this.deletePin(scopeUnitId, commentId, PinKindEnum.ACCEPTED_ANSWER);
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
    const db = await getServerDb();
    const scope = await getPostByUnitId(scopeUnitId, db);

    if (!scope) {
      const [unit] = await db
        .select({ type: Unit.type })
        .from(Unit)
        .where(eq(Unit.id, scopeUnitId))
        .limit(1);
      if (unit?.type === "REALM") {
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
        realmUnitIds: (scope.unit.inRealms ?? []).map((row) => row.realmUnitId),
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
      const db = await getServerDb();
      const [ownedRealm] = await db
        .select({ id: Unit.id })
        .from(Unit)
        .where(
          and(
            inArray(Unit.id, scope.realmUnitIds),
            eq(Unit.userId, caller.userId),
          ),
        )
        .limit(1);
      if (ownedRealm) return true;
      const [moderator] = await db
        .select({ realmUnitId: RealmMember.realmUnitId })
        .from(RealmMember)
        .where(
          and(
            inArray(RealmMember.realmUnitId, scope.realmUnitIds),
            eq(RealmMember.userId, caller.userId),
            inArray(RealmMember.roleKey, [...PROMOTION_ROLES]),
          ),
        )
        .limit(1);
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

    const scope = await getPostByUnitId(rootPostUnitId);

    // Only a real thread root post can be promoted into; anything else -> false.
    if (!scope) {
      return { viewerCanPromote: false, isQuestionThread: isQuestion };
    }

    const viewerCanPromote = await this.canPromoteInThread(
      {
        authorUserId: scope.authorUserId,
        realmUnitIds: (scope.unit.inRealms ?? []).map((row) => row.realmUnitId),
      },
      caller,
    );
    return { viewerCanPromote, isQuestionThread: isQuestion };
  }

  /** Validate the target is a reply within the scope thread; return its shape. */
  private async loadPromotableTarget(
    scopeUnitId: string,
    commentId: string,
  ): Promise<{ depth: number; parentCommentId: string | null }> {
    const db = await getServerDb();
    const [comment] = await db
      .select({
        depth: Comment.depth,
        rootUnitId: Comment.rootUnitId,
        parentCommentId: Comment.parentCommentId,
      })
      .from(Comment)
      .where(eq(Comment.id, commentId))
      .limit(1);
    if (!comment) {
      throw new AppError(404, `Promotable target not found: ${commentId}`);
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
      parentCommentId: comment.parentCommentId,
    };
  }

  /**
   * Mint a fractional `position` within the `(scope, kind)` group. Explicit
   * before/after anchors place precisely; otherwise the pin appends after the
   * current last pin in the group. Reordering one pin never renumbers others.
   */
  private async mintPinPosition(
    scopeUnitId: string,
    kind: PinKindValue,
    beforeTargetCommentId?: string,
    afterTargetCommentId?: string,
  ): Promise<string> {
    const db = await getServerDb();
    const positionOf = async (commentId?: string) => {
      if (!commentId) return undefined;
      const [pin] = await db
        .select({ position: CommentPromotion.position })
        .from(CommentPromotion)
        .where(
          and(
            eq(CommentPromotion.scopeUnitId, scopeUnitId),
            eq(CommentPromotion.commentId, commentId),
          ),
        )
        .limit(1);
      return pin?.position ?? undefined;
    };
    const afterPos = await positionOf(afterTargetCommentId);
    const beforePos = await positionOf(beforeTargetCommentId);
    if (afterPos !== undefined || beforePos !== undefined) {
      return generateBetween(afterPos, beforePos);
    }
    const [last] = await db
      .select({ position: CommentPromotion.position })
      .from(CommentPromotion)
      .where(
        and(
          eq(CommentPromotion.scopeUnitId, scopeUnitId),
          eq(CommentPromotion.kind, kind),
        ),
      )
      .orderBy(desc(CommentPromotion.position))
      .limit(1);
    return generateBetween(last?.position ?? undefined, undefined);
  }

  private async createPin(
    scopeUnitId: string,
    commentId: string,
    kind: PinKindValue,
    position: string,
    byUserId: string,
  ): Promise<CommentPromotionDTO> {
    try {
      const db = await getServerDb();
      const [pin] = await db
        .insert(CommentPromotion)
        .values({
          scopeUnitId,
          commentId: commentId,
          kind,
          position,
          byUserId,
        })
        .returning();
      if (!pin) throw new Error("Failed to create comment promotion");
      return mapCommentPromotionToDTO(pin);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        (error as { code?: string }).code === "23505"
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
    commentId: string,
    kind: PinKindValue,
  ): Promise<void> {
    const db = await getServerDb();
    const [existing] = await db
      .select({ kind: CommentPromotion.kind })
      .from(CommentPromotion)
      .where(
        and(
          eq(CommentPromotion.scopeUnitId, scopeUnitId),
          eq(CommentPromotion.commentId, commentId),
        ),
      )
      .limit(1);
    if (!existing || existing.kind !== kind) {
      throw new AppError(404, "Promotion not found for this comment and scope");
    }
    await db
      .delete(CommentPromotion)
      .where(
        and(
          eq(CommentPromotion.scopeUnitId, scopeUnitId),
          eq(CommentPromotion.commentId, commentId),
        ),
      );
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
