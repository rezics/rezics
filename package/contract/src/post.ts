import { t } from "elysia";
import { creationModeSchema } from "./content-authority";
import { contentDocSchema, contentDocWriteSchema } from "./content-doc";
import { licenseSlugSchema } from "./license";
import { listGetQueryBase, listPostBodyBase } from "./list-query-base";
import { paginationLimitSchema } from "./pagination";
import { publicUserSchema } from "./unit";

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
// EXCERPT SOURCE SCHEMA
// ============================================================

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
  title: t.Optional(t.String()),
  book: t.Optional(
    t.Object({
      id: t.String(),
      title: t.String(),
    }),
  ),
  source: t.Optional(excerptSourceSchema),
});

export type PostExtra = (typeof postExtraSchema)["static"];

// ============================================================
// POST DTO (replaces Comment, Review, Note, Remark)
// ============================================================

export const postDTOSchema = t.Object({
  unitId: t.String(),
  authorUserId: t.String(),
  author: t.Optional(publicUserSchema),
  targetUnitId: t.Optional(t.Nullable(t.String())),
  realmUnitId: t.Optional(t.Nullable(t.String())),
  content: t.Optional(t.Nullable(contentDocSchema)),
  rootPostUnitId: t.Optional(t.Nullable(t.String())),
  parentPostUnitId: t.Optional(t.Nullable(t.String())),
  kind: t.Optional(t.Nullable(postKindLiterals)),
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
  isTombstone: t.Optional(t.Boolean()),
  depth: t.Optional(t.Number()),
  sortPath: t.Optional(t.Nullable(t.String())),
  replyCount: t.Optional(t.Number()),
  directReplyCount: t.Optional(t.Number()),
  lastReplyAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  isLocked: t.Optional(t.Boolean()),
  scoreEntryId: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(postExtraSchema)),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type PostDTO = (typeof postDTOSchema)["static"];

// ============================================================
// POST LIST/QUERY
// ============================================================

export const postListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  /** Target Unit ID for reply/thread targets. Realm feeds use `realmUnitId`. */
  targetUnitId: t.Optional(t.String()),
  /** Realm Unit ID to list posts through the RealmUnit junction. */
  realmUnitId: t.Optional(t.String()),
  /** Any-of tag filter for realm feed queries. */
  tagIds: t.Optional(t.Array(t.String())),
  rootPostUnitId: t.Optional(t.String()),
  /** Post Unit ID to use as the anchor for descendant subtree queries. */
  subtreeRootPostUnitId: t.Optional(t.String()),
  parentPostUnitId: t.Optional(t.String()),
  authorUserId: t.Optional(t.String()),
  kind: t.Optional(postKindLiterals),
  mode: t.Optional(t.String()),
  maxDepth: t.Optional(t.Number()),
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
      createdAt: t.Optional(t.String()),
      sortPath: t.Optional(t.String()),
    }),
  ),
  limit: paginationLimitSchema,
});

export type PostListQuery = (typeof postListQuerySchema)["static"];

export const postListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  /** Target Unit ID for reply/thread targets. Realm feeds use `realmUnitId`. */
  targetUnitId: t.Optional(t.String()),
  /** Realm Unit ID to list posts through the RealmUnit junction. */
  realmUnitId: t.Optional(t.String()),
  /** Any-of tag filter for realm feed queries. */
  tagIds: t.Optional(t.Array(t.String())),
  rootPostUnitId: t.Optional(t.String()),
  /** Post Unit ID to use as the anchor for descendant subtree queries. */
  subtreeRootPostUnitId: t.Optional(t.String()),
  parentPostUnitId: t.Optional(t.String()),
  authorUserId: t.Optional(t.String()),
  kind: t.Optional(postKindLiterals),
  mode: t.Optional(t.String()),
  maxDepth: t.Optional(t.Number()),
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
      createdAt: t.Optional(t.String()),
      sortPath: t.Optional(t.String()),
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

// ============================================================
// POST PARAMS/RESPONSE
// ============================================================

export const postParamsSchema = t.Object({
  unitId: t.String(),
});

export type PostParams = (typeof postParamsSchema)["static"];

export const postResponseSchema = postDTOSchema;
export type PostResponse = (typeof postResponseSchema)["static"];

// ============================================================
// CREATE/UPDATE POST
// ============================================================

export const createPostSchema = t.Object({
  targetUnitId: t.Optional(t.String()),
  /**
   * Realm Unit IDs that create RealmUnit junction rows in the same transaction
   * as the Post.
   */
  realmUnitIds: t.Optional(t.Array(t.String())),
  /** Tag Unit IDs that create UnitTag junction rows in the same transaction. */
  tagIds: t.Optional(t.Array(t.String())),
  parentPostUnitId: t.Optional(t.String()),
  kind: t.Optional(postKindLiterals),
  creationMode: t.Optional(creationModeSchema),
  content: contentDocWriteSchema,
  scoreEntryId: t.Optional(t.String()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type CreatePostInput = (typeof createPostSchema)["static"];

export const updatePostSchema = t.Object({
  content: t.Optional(contentDocWriteSchema),
  isLocked: t.Optional(t.Boolean()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpdatePostInput = (typeof updatePostSchema)["static"];
