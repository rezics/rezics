import { t } from "elysia";
import { creationModeSchema } from "../content/authority";
import { contentDocSchema, contentDocWriteSchema } from "../content/doc-v1";
import { languageSchema } from "../language";
import { licenseSlugSchema } from "../license";
import {
  listGetQueryBase,
  listLanguageModeSchema,
  listPostBodyBase,
} from "../list-query-base";
import { paginationLimitSchema } from "../pagination";
import {
  moderationOverlayDTOSchema,
  moderationStatusSchema,
} from "../realm/governance";
import { publicUserSchema, variantContextSummarySchema } from "../unit/unit";

// ============================================================
// POST KIND
// ============================================================

export const PostKind = {
  REVIEW: "REVIEW",
  REMARK: "REMARK",
  EXCERPT: "EXCERPT",
  POST: "POST",
  CHAPTER: "CHAPTER",
  WIKI: "WIKI",
} as const;

export const postKindValues = [
  "REVIEW",
  "EXCERPT",
  "REMARK",
  "POST",
  "CHAPTER",
  "WIKI",
] as const;

export type PostKind = (typeof PostKind)[keyof typeof PostKind];

export const postKindLiterals = t.Union([
  t.Literal("REVIEW"),
  t.Literal("REMARK"),
  t.Literal("EXCERPT"),
  t.Literal("POST"),
  t.Literal("CHAPTER"),
  t.Literal("WIKI"),
]);

// ============================================================
// PIN KIND (post promotion overlay)
// ============================================================

export const PinKind = {
  ACCEPTED_ANSWER: "ACCEPTED_ANSWER",
  PINNED: "PINNED",
  HIGHLIGHT: "HIGHLIGHT",
} as const;

export const pinKindValues = [
  "ACCEPTED_ANSWER",
  "PINNED",
  "HIGHLIGHT",
] as const;

export type PinKind = (typeof PinKind)[keyof typeof PinKind];

export const pinKindLiterals = t.Union([
  t.Literal("ACCEPTED_ANSWER"),
  t.Literal("PINNED"),
  t.Literal("HIGHLIGHT"),
]);

/**
 * Platform-reserved tag slug whose `Unit(type=TAG)` marks a thread as a Q&A
 * thread when borne by the root post. Uniform across all realms.
 */
export const OFFICIAL_QUESTION_TAG_SLUG = "question";

// ============================================================
// EXCERPT SOURCE SCHEMA
// ============================================================

/**
 * URL mode accepts any well-formed URL — no rezics-domain or ancestry
 * restriction (internal-vs-external is a render-time concern). Unit mode accepts
 * any unitId regardless of the post target ancestry. `title` is an author
 * snapshot, never auto-synced to the linked unit name.
 */
export const excerptSourceSchema = t.Union([
  t.Object({
    mode: t.Literal("unit"),
    unitId: t.String(),
    title: t.String({ minLength: 1, maxLength: 200 }),
  }),
  t.Object({
    mode: t.Literal("url"),
    url: t.String({ maxLength: 2048 }),
    title: t.String({ minLength: 1, maxLength: 200 }),
  }),
]);

export type ExcerptSource = (typeof excerptSourceSchema)["static"];

// ============================================================
// POST EXTRA SCHEMA
// ============================================================

export const postExtraSchema = t.Object({
  rating: t.Optional(t.Number()),
  book: t.Optional(
    t.Object({
      id: t.String(),
      title: t.String(),
    }),
  ),
  source: t.Optional(excerptSourceSchema),
  /**
   * Slug of the tag whose schema governs `Post.state`, snapshotted at creation.
   * It does NOT drift when tags are later added/removed, so the governing
   * vocabulary stays stable (see `post-state-schema.ts`). Present only on posts
   * created with a stateful tag.
   */
  stateSchemaTag: t.Optional(t.String()),
});

export type PostExtra = (typeof postExtraSchema)["static"];

// ============================================================
// POST DTO
// ============================================================

export const postDTOSchema = t.Object({
  unitId: t.String(),
  authorUserId: t.String(),
  author: t.Optional(publicUserSchema),
  targetUnitId: t.Optional(t.Nullable(t.String())),
  variantUnitId: t.Optional(t.Nullable(t.String())),
  variantContext: t.Optional(t.Nullable(variantContextSummarySchema)),
  realmUnitId: t.Optional(t.Nullable(t.String())),
  referenceCount: t.Optional(t.Number()),
  shareCount: t.Optional(t.Number()),
  resolvedLanguage: t.Optional(t.Nullable(languageSchema)),
  /** Resolved root-post display title for the selected/default language. */
  title: t.Optional(t.Nullable(t.String())),
  /**
   * Resolved root-post body content for the selected/default language.
   * Root-post reads resolve this from ContentTranslation.
   */
  content: t.Optional(t.Nullable(contentDocSchema)),
  kind: t.Optional(t.Nullable(postKindLiterals)),
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
  moderationStatus: t.Optional(t.Nullable(moderationStatusSchema)),
  isTombstone: t.Optional(t.Boolean()),
  replyCount: t.Optional(t.Number()),
  directReplyCount: t.Optional(t.Number()),
  lastReplyAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  isLocked: t.Optional(t.Boolean()),
  /**
   * Lifecycle label — a kebab-case slug (e.g. `open`, `solved`, `not-planned`)
   * governed by the schema named by `extra.stateSchemaTag`, or null for no
   * lifecycle. Typed as a generic string, NOT a strict enum: reads tolerate
   * unknown values so adding a value never breaks an older client (the client
   * renders the value via its mapped tag, falling back to the raw slug). The
   * closed vocabulary and transitions are enforced only on the write path.
   */
  state: t.Optional(t.Nullable(t.String())),
  scoreEntryId: t.Optional(t.Nullable(t.String())),
  /**
   * Promotion overlay for the rendered thread scope: why this reply is promoted
   * (accepted answer vs. pin), or null when it is an ordinary reply. Set by the
   * thread read; the client groups promoted replies ahead of ordinary ones.
   */
  pinKind: t.Optional(t.Nullable(pinKindLiterals)),
  /** Fractional-index position within its `pinKind` group (for render order). */
  pinPosition: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(postExtraSchema)),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type PostDTO = (typeof postDTOSchema)["static"];

// ============================================================
// COMMENT PROMOTION DTO + REQUESTS
// ============================================================

export const commentPromotionDTOSchema = t.Object({
  scopeUnitId: t.String(),
  commentId: t.String(),
  kind: pinKindLiterals,
  position: t.String(),
  byUserId: t.String(),
  createdAt: t.Union([t.String(), t.Date()]),
});

export type CommentPromotionDTO = (typeof commentPromotionDTOSchema)["static"];

/**
 * Pin a comment (`kind = PINNED`) within its thread scope. `scopeUnitId` MUST
 * be the thread root post; `commentId` MUST be a comment in that thread.
 */
export const pinCommentSchema = t.Object({
  scopeUnitId: t.String(),
  commentId: t.String(),
  /** Optional explicit ordering anchors; the server mints a position between them. */
  beforeTargetCommentId: t.Optional(t.String()),
  afterTargetCommentId: t.Optional(t.String()),
});

export type PinCommentInput = (typeof pinCommentSchema)["static"];

/** Accept a direct reply as an answer (`kind = ACCEPTED_ANSWER`) in a Q&A thread. */
export const acceptAnswerSchema = t.Object({
  scopeUnitId: t.String(),
  commentId: t.String(),
  beforeTargetCommentId: t.Optional(t.String()),
  afterTargetCommentId: t.Optional(t.String()),
});

export type AcceptAnswerInput = (typeof acceptAnswerSchema)["static"];

// ============================================================
// POST LIST/QUERY
// ============================================================

export const postListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  /** Target Unit ID for root posts. Realm feeds use `realmUnitId`. */
  targetUnitId: t.Optional(t.String()),
  /** Exact VARIANT context lookup. Does not replace targetUnitId aggregation. */
  variantUnitId: t.Optional(t.String()),
  /** Realm Unit ID to list posts through the UnitRealm junction. */
  realmUnitId: t.Optional(t.String()),
  /** Any-of tag filter for realm feed queries. */
  tagIds: t.Optional(t.Array(t.String())),
  /** Moderator UnitRealm moderation filter. Regular callers are always approved. */
  realmModerationStatus: t.Optional(
    t.Union([moderationStatusSchema, t.Literal("all")]),
  ),
  authorUserId: t.Optional(t.String()),
  kind: t.Optional(postKindLiterals),
  /** Exact lifecycle-state filter (e.g. `open`). */
  state: t.Optional(t.String()),
  /**
   * Derived lifecycle bucket filter: `active` or `closed`. Matches posts whose
   * `state` is any value declared in that bucket across the registered schemas
   * (`state IN (…)`, indexed; no anti-join). Buckets are never stored.
   */
  stateBucket: t.Optional(t.Union([t.Literal("active"), t.Literal("closed")])),
  languages: t.Optional(t.String()),
  languageMode: t.Optional(listLanguageModeSchema),
  sort: t.Optional(
    t.Union([
      t.Literal("new"),
      t.Literal("top"),
      t.Literal("hot"),
      t.Object({
        field: t.Optional(t.String()),
        order: t.Optional(t.String()),
      }),
    ]),
  ),
  start: t.Optional(t.Number()),
  cursor: t.Optional(
    t.Object({
      unitId: t.Optional(t.String()),
      sortValue: t.Optional(t.Union([t.Number(), t.String()])),
      createdAt: t.Optional(t.String()),
    }),
  ),
  limit: paginationLimitSchema,
});

export type PostListQuery = (typeof postListQuerySchema)["static"];

export const postListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  /** Target Unit ID for root posts. Realm feeds use `realmUnitId`. */
  targetUnitId: t.Optional(t.String()),
  /** Exact VARIANT context lookup. Does not replace targetUnitId aggregation. */
  variantUnitId: t.Optional(t.String()),
  /** Realm Unit ID to list posts through the UnitRealm junction. */
  realmUnitId: t.Optional(t.String()),
  /** Any-of tag filter for realm feed queries. */
  tagIds: t.Optional(t.Array(t.String())),
  /** Moderator UnitRealm moderation filter. Regular callers are always approved. */
  realmModerationStatus: t.Optional(
    t.Union([moderationStatusSchema, t.Literal("all")]),
  ),
  authorUserId: t.Optional(t.String()),
  kind: t.Optional(postKindLiterals),
  /** Exact lifecycle-state filter (e.g. `open`). */
  state: t.Optional(t.String()),
  /** Derived lifecycle bucket filter: `active` or `closed`. See `postListQuerySchema`. */
  stateBucket: t.Optional(t.Union([t.Literal("active"), t.Literal("closed")])),
  languages: t.Optional(t.Array(languageSchema)),
  languageMode: t.Optional(listLanguageModeSchema),
  sort: t.Optional(
    t.Union([
      t.Literal("new"),
      t.Literal("top"),
      t.Literal("hot"),
      t.Object({
        field: t.Optional(t.String()),
        order: t.Optional(t.String()),
      }),
    ]),
  ),
  start: t.Optional(t.Number()),
  cursor: t.Optional(
    t.Object({
      unitId: t.Optional(t.String()),
      sortValue: t.Optional(t.Union([t.Number(), t.String()])),
      createdAt: t.Optional(t.String()),
    }),
  ),
  limit: paginationLimitSchema,
});

export type PostListBody = (typeof postListBodySchema)["static"];

export const postListResponseSchema = t.Object({
  posts: t.Array(postDTOSchema),
  total: t.Optional(t.Number()),
});

export type PostListResponse = (typeof postListResponseSchema)["static"];

export const postModerationOverlayRequestSchema = t.Object({
  realmUnitId: t.Optional(t.Nullable(t.String())),
  targetUnitIds: t.Array(t.String()),
});

export type PostModerationOverlayRequest =
  (typeof postModerationOverlayRequestSchema)["static"];

export const postModerationOverlayResponseSchema = t.Object({
  overlays: t.Array(moderationOverlayDTOSchema),
});

export type PostModerationOverlayResponse =
  (typeof postModerationOverlayResponseSchema)["static"];

// ============================================================
// POST PARAMS/RESPONSE
// ============================================================

export const postParamsSchema = t.Object({
  unitId: t.String(),
});

export type PostParams = (typeof postParamsSchema)["static"];

export const postReadQuerySchema = t.Object({
  languages: t.Optional(t.String()),
});

export type PostReadQuery = (typeof postReadQuerySchema)["static"];

export const postResponseSchema = postDTOSchema;
export type PostResponse = (typeof postResponseSchema)["static"];

// ============================================================
// CREATE/UPDATE POST
// ============================================================

export const createPostSchema = t.Object({
  targetUnitId: t.Optional(t.String({ minLength: 1 })),
  /**
   * Weak selected VARIANT context. Normal posts still aggregate on
   * `targetUnitId`; this value is not validated as existing or as a VARIANT.
   */
  variantUnitId: t.Optional(t.String({ minLength: 1 })),
  /**
   * Realm Unit IDs that create UnitRealm junction rows in the same transaction
   * as the Post.
   */
  realmUnitIds: t.Optional(t.Array(t.String())),
  /** Tag Unit IDs that create UnitTag junction rows in the same transaction. */
  tagIds: t.Optional(t.Array(t.String())),
  kind: t.Optional(postKindLiterals),
  language: languageSchema,
  creationMode: t.Optional(creationModeSchema),
  title: t.String({ minLength: 1, maxLength: 300 }),
  content: contentDocWriteSchema,
  scoreEntryId: t.Optional(t.String()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  /**
   * Initial publication state. Defaults to `PUBLISHED` (publish on create).
   * `DRAFT` saves the post as an owner-only draft that is excluded from feeds
   * and search until published. See `draft.ts` for the cross-type draft listing.
   */
  status: t.Optional(t.Union([t.Literal("DRAFT"), t.Literal("PUBLISHED")])),
});

export type CreatePostInput = (typeof createPostSchema)["static"];

/** Toggle a post between published and draft (owner-only). */
export const setPostPublicationSchema = t.Object({
  publish: t.Boolean(),
});

export type SetPostPublicationInput =
  (typeof setPostPublicationSchema)["static"];

export const submitPostToRealmSchema = t.Object({
  realmUnitId: t.String(),
  tagIds: t.Optional(t.Array(t.String())),
  publish: t.Optional(t.Boolean()),
});

export type SubmitPostToRealmInput = (typeof submitPostToRealmSchema)["static"];

export const updatePostSchema = t.Object({
  title: t.Optional(t.String({ minLength: 1, maxLength: 300 })),
  content: t.Optional(contentDocWriteSchema),
  language: t.Optional(languageSchema),
  isLocked: t.Optional(t.Boolean()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpdatePostInput = (typeof updatePostSchema)["static"];

/**
 * Transition a post's lifecycle `state` to a target value. Write-strict: the
 * server normalizes the slug and rejects it unless it is a legal value of the
 * post's schema and the transition from the current state is allowed. Closing
 * always names a reason value; reopening targets the schema's initial state.
 */
export const setPostStateSchema = t.Object({
  state: t.String(),
});

export type SetPostStateInput = (typeof setPostStateSchema)["static"];
