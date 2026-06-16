import { t } from "elysia";
import { creationModeSchema } from "../content/authority";
import { contentDocSchema, contentDocWriteSchema } from "../content/doc-v1";
import { languageSchema } from "../language";
import { licenseSlugSchema } from "../license";
import {
  listGetQueryBase,
  listPostBodyBase,
  readLanguageBodyBase,
  readLanguageGetQueryBase,
} from "../list-query-base";
import { paginationLimitSchema } from "../pagination";
import {
  moderationOverlayDTOSchema,
  moderationStatusSchema,
} from "../realm/governance";
import { publicUserSchema, variantContextSummarySchema } from "../unit/unit";

// ============================================================
// POST KIND
// 帖子类型
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
// 置顶类型（帖子推荐叠加层）
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
 * 平台保留的标签 slug，其 `Unit(type=TAG)` 在被根帖子携带时将主题标记为问答
 * 主题。在所有 realm 中保持一致。
 */
export const OFFICIAL_QUESTION_TAG_SLUG = "question";

// ============================================================
// EXCERPT SOURCE SCHEMA
// 摘录来源 schema
// ============================================================

/**
 * URL mode accepts any well-formed URL — no rezics-domain or ancestry
 * restriction (internal-vs-external is a render-time concern). Unit mode accepts
 * any unitId regardless of the post target ancestry. `title` is an author
 * snapshot, never auto-synced to the linked unit name.
 * URL 模式接受任何格式正确的 URL——不限制 rezics 域名或祖先关系（内部与外部之分
 * 是渲染时的关注点）。Unit 模式接受任何 unitId，无论帖子目标的祖先关系如何。
 * `title` 是作者快照，绝不自动同步到所链接的 unit 名称。
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
// 帖子附加字段 schema
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
   * 在创建时快照的标签 slug，其 schema 管控 `Post.state`。当标签后续被添加/移除时
   * 它不会漂移，因此管控词汇表保持稳定（见 `post-state-schema.ts`）。仅存在于
   * 使用有状态标签创建的帖子上。
   */
  stateSchemaTag: t.Optional(t.String()),
});

export type PostExtra = (typeof postExtraSchema)["static"];

// ============================================================
// POST DTO
// 帖子 DTO
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
  /**
   * Resolved root-post display title for the selected/default language.
   * 针对选定/默认语言解析后的根帖子展示标题。
   */
  title: t.Optional(t.Nullable(t.String())),
  /**
   * Resolved root-post body content for the selected/default language.
   * Root-post reads resolve this from ContentTranslation.
   * 针对选定/默认语言解析后的根帖子正文内容。根帖子读取从 ContentTranslation
   * 解析此值。
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
   * 生命周期标签——一个 kebab-case slug（如 `open`、`solved`、`not-planned`），
   * 由 `extra.stateSchemaTag` 命名的 schema 管控，无生命周期时为 null。类型为
   * 通用 string，而非严格枚举：读取容忍未知值，因此新增值绝不会破坏旧客户端
   * （客户端通过其映射的标签渲染该值，回退到原始 slug）。封闭词汇表与状态转换
   * 仅在写入路径上强制执行。
   */
  state: t.Optional(t.Nullable(t.String())),
  scoreEntryId: t.Optional(t.Nullable(t.String())),
  /**
   * Promotion overlay for the rendered thread scope: why this reply is promoted
   * (accepted answer vs. pin), or null when it is an ordinary reply. Set by the
   * thread read; the client groups promoted replies ahead of ordinary ones.
   * 渲染主题范围的推荐叠加层：说明此回复被推荐的原因（采纳答案还是置顶），普通
   * 回复时为 null。由主题读取设置；客户端将被推荐的回复分组排在普通回复之前。
   */
  pinKind: t.Optional(t.Nullable(pinKindLiterals)),
  /**
   * Fractional-index position within its `pinKind` group (for render order).
   * 在其 `pinKind` 分组内的分数索引位置（用于渲染顺序）。
   */
  pinPosition: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(postExtraSchema)),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type PostDTO = (typeof postDTOSchema)["static"];

// ============================================================
// COMMENT PROMOTION DTO + REQUESTS
// 评论推荐 DTO + 请求
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
 * 在主题范围内置顶一条评论（`kind = PINNED`）。`scopeUnitId` 必须是主题根帖子；
 * `commentId` 必须是该主题中的一条评论。
 */
export const pinCommentSchema = t.Object({
  scopeUnitId: t.String(),
  commentId: t.String(),
  /**
   * Optional explicit ordering anchors; the server mints a position between them.
   * 可选的显式排序锚点；服务端在它们之间生成一个位置。
   */
  beforeTargetCommentId: t.Optional(t.String()),
  afterTargetCommentId: t.Optional(t.String()),
});

export type PinCommentInput = (typeof pinCommentSchema)["static"];

/**
 * Accept a direct reply as an answer (`kind = ACCEPTED_ANSWER`) in a Q&A thread.
 * 在问答主题中将一条直接回复采纳为答案（`kind = ACCEPTED_ANSWER`）。
 */
export const acceptAnswerSchema = t.Object({
  scopeUnitId: t.String(),
  commentId: t.String(),
  beforeTargetCommentId: t.Optional(t.String()),
  afterTargetCommentId: t.Optional(t.String()),
});

export type AcceptAnswerInput = (typeof acceptAnswerSchema)["static"];

// ============================================================
// POST LIST/QUERY
// 帖子列表/查询
// ============================================================

export const postListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  ...readLanguageGetQueryBase.properties,
  /**
   * Target Unit ID for root posts. Realm feeds use `realmUnitId`.
   * 根帖子的目标 Unit ID。realm 信息流使用 `realmUnitId`。
   */
  targetUnitId: t.Optional(t.String()),
  /**
   * Exact VARIANT context lookup. Does not replace targetUnitId aggregation.
   * 精确的 VARIANT 上下文查找。不替代 targetUnitId 聚合。
   */
  variantUnitId: t.Optional(t.String()),
  /**
   * Realm Unit ID to list posts through the UnitRealm junction.
   * 通过 UnitRealm 关联表列出帖子的 realm Unit ID。
   */
  realmUnitId: t.Optional(t.String()),
  /**
   * Any-of tag filter for realm feed queries.
   * realm 信息流查询的任一标签匹配过滤器。
   */
  tagIds: t.Optional(t.Array(t.String())),
  /**
   * Moderator UnitRealm moderation filter. Regular callers are always approved.
   * 版主的 UnitRealm 审核过滤器。普通调用者始终为已批准状态。
   */
  realmModerationStatus: t.Optional(
    t.Union([moderationStatusSchema, t.Literal("all")]),
  ),
  authorUserId: t.Optional(t.String()),
  kind: t.Optional(postKindLiterals),
  /**
   * Exact lifecycle-state filter (e.g. `open`).
   * 精确的生命周期状态过滤器（如 `open`）。
   */
  state: t.Optional(t.String()),
  /**
   * Derived lifecycle bucket filter: `active` or `closed`. Matches posts whose
   * `state` is any value declared in that bucket across the registered schemas
   * (`state IN (…)`, indexed; no anti-join). Buckets are never stored.
   * 派生的生命周期分桶过滤器：`active` 或 `closed`。匹配 `state` 为已注册 schema
   * 中该分桶内所声明的任意值的帖子（`state IN (…)`，有索引；无反连接）。分桶从不
   * 被存储。
   */
  stateBucket: t.Optional(t.Union([t.Literal("active"), t.Literal("closed")])),
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
  ...readLanguageBodyBase.properties,
  /**
   * Target Unit ID for root posts. Realm feeds use `realmUnitId`.
   * 根帖子的目标 Unit ID。realm 信息流使用 `realmUnitId`。
   */
  targetUnitId: t.Optional(t.String()),
  /**
   * Exact VARIANT context lookup. Does not replace targetUnitId aggregation.
   * 精确的 VARIANT 上下文查找。不替代 targetUnitId 聚合。
   */
  variantUnitId: t.Optional(t.String()),
  /**
   * Realm Unit ID to list posts through the UnitRealm junction.
   * 通过 UnitRealm 关联表列出帖子的 realm Unit ID。
   */
  realmUnitId: t.Optional(t.String()),
  /**
   * Any-of tag filter for realm feed queries.
   * realm 信息流查询的任一标签匹配过滤器。
   */
  tagIds: t.Optional(t.Array(t.String())),
  /**
   * Moderator UnitRealm moderation filter. Regular callers are always approved.
   * 版主的 UnitRealm 审核过滤器。普通调用者始终为已批准状态。
   */
  realmModerationStatus: t.Optional(
    t.Union([moderationStatusSchema, t.Literal("all")]),
  ),
  authorUserId: t.Optional(t.String()),
  kind: t.Optional(postKindLiterals),
  /**
   * Exact lifecycle-state filter (e.g. `open`).
   * 精确的生命周期状态过滤器（如 `open`）。
   */
  state: t.Optional(t.String()),
  /**
   * Derived lifecycle bucket filter: `active` or `closed`. See `postListQuerySchema`.
   * 派生的生命周期分桶过滤器：`active` 或 `closed`。见 `postListQuerySchema`。
   */
  stateBucket: t.Optional(t.Union([t.Literal("active"), t.Literal("closed")])),
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
// 帖子参数/响应
// ============================================================

export const postParamsSchema = t.Object({
  unitId: t.String(),
});

export type PostParams = (typeof postParamsSchema)["static"];

export const postReadQuerySchema = t.Object({
  ...readLanguageGetQueryBase.properties,
  explicitLanguage: t.Optional(languageSchema),
});

export type PostReadQuery = (typeof postReadQuerySchema)["static"];

export const postResponseSchema = postDTOSchema;
export type PostResponse = (typeof postResponseSchema)["static"];

// ============================================================
// CREATE/UPDATE POST
// 创建/更新帖子
// ============================================================

export const createPostSchema = t.Object({
  targetUnitId: t.Optional(t.String({ minLength: 1 })),
  /**
   * Weak selected VARIANT context. Normal posts still aggregate on
   * `targetUnitId`; this value is not validated as existing or as a VARIANT.
   * 弱选定的 VARIANT 上下文。普通帖子仍按 `targetUnitId` 聚合；此值不会被校验为
   * 存在或为 VARIANT。
   */
  variantUnitId: t.Optional(t.String({ minLength: 1 })),
  /**
   * Realm Unit IDs that create UnitRealm junction rows in the same transaction
   * as the Post.
   * 在与 Post 同一事务中创建 UnitRealm 关联行的 realm Unit ID。
   */
  realmUnitIds: t.Optional(t.Array(t.String())),
  /**
   * Tag Unit IDs that create UnitTag junction rows in the same transaction.
   * 在同一事务中创建 UnitTag 关联行的标签 Unit ID。
   */
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
   * 初始发布状态。默认为 `PUBLISHED`（创建即发布）。`DRAFT` 将帖子保存为仅作者
   * 可见的草稿，在发布前从信息流和搜索中排除。跨类型草稿列表见 `draft.ts`。
   */
  status: t.Optional(t.Union([t.Literal("DRAFT"), t.Literal("PUBLISHED")])),
});

export type CreatePostInput = (typeof createPostSchema)["static"];

/**
 * Toggle a post between published and draft (owner-only).
 * 在已发布和草稿之间切换帖子（仅作者）。
 */
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
 * 将帖子的生命周期 `state` 转换为目标值。写入严格：服务端规范化 slug，除非它是
 * 帖子 schema 的合法值且允许从当前状态转换，否则予以拒绝。关闭时总是指定一个
 * 原因值；重新打开则以 schema 的初始状态为目标。
 */
export const setPostStateSchema = t.Object({
  state: t.String(),
});

export type SetPostStateInput = (typeof setPostStateSchema)["static"];
