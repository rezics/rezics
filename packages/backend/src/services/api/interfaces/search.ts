import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware, OptionalAuthMiddleware, Unauthorized } from "./middlewares/auth.ts";

// ---------------------------------------------------------------------------
// Response schemas — typed DTOs matching handler return shapes
// 响应 schema —— 匹配 handler 返回结构的类型化 DTO
// ---------------------------------------------------------------------------

export class MeiliHealthResult extends Schema.Class<MeiliHealthResult>("MeiliHealthResult")({
  status: Schema.String,
}) {}

export class AdminMessageResult extends Schema.Class<AdminMessageResult>("AdminMessageResult")({
  message: Schema.String,
}) {}

/** Status endpoint response. / 状态端点响应。 */
export class MeiliStatusResult extends Schema.Class<MeiliStatusResult>("MeiliStatusResult")({
  status: Schema.String,
  meili: Schema.String,
}) {}

/** Single unit search hit. / 单个 Unit 搜索命中。 */
export class UnitSearchHitDTO extends Schema.Class<UnitSearchHitDTO>("UnitSearchHitDTO")({
  id: Schema.String,
  type: Schema.String,
  slug: Schema.NullOr(Schema.String),
  title: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

/** Paginated unit search result. / 分页 Unit 搜索结果。 */
export class UnitSearchResult extends Schema.Class<UnitSearchResult>("UnitSearchResult")({
  hits: Schema.Array(UnitSearchHitDTO),
  total: Schema.Number,
}) {}

/** Single user search hit. / 单个用户搜索命中。 */
export class UserSearchHitDTO extends Schema.Class<UserSearchHitDTO>("UserSearchHitDTO")({
  unitId: Schema.String,
  name: Schema.NullOr(Schema.String),
  email: Schema.NullOr(Schema.String),
  avatar: Schema.NullOr(Schema.String),
  summary: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
}) {}

/** Paginated user search result. / 分页用户搜索结果。 */
export class UserSearchResult extends Schema.Class<UserSearchResult>("UserSearchResult")({
  users: Schema.Array(UserSearchHitDTO),
  total: Schema.Number,
}) {}

/** Single comment search hit. / 单个评论搜索命中。 */
export class CommentSearchHitDTO extends Schema.Class<CommentSearchHitDTO>("CommentSearchHitDTO")({
  id: Schema.String,
  rootUnitId: Schema.String,
  authorUserId: Schema.String,
  createdAt: Schema.String,
}) {}

/** Paginated comment search result. / 分页评论搜索结果。 */
export class CommentSearchResult extends Schema.Class<CommentSearchResult>("CommentSearchResult")({
  hits: Schema.Array(CommentSearchHitDTO),
  total: Schema.Number,
}) {}

/** Federated search hit (union of unit and user results). / 联邦搜索命中（Unit 与用户结果的联合）。 */
export class FederatedHitDTO extends Schema.Class<FederatedHitDTO>("FederatedHitDTO")({
  id: Schema.String,
  type: Schema.String,
  slug: Schema.NullOr(Schema.String),
  title: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  _index: Schema.String,
}) {}

/** Federated search totals breakdown. / 联邦搜索各索引计数。 */
export class FederatedTotalsDTO extends Schema.Class<FederatedTotalsDTO>("FederatedTotalsDTO")({
  content: Schema.Number,
  realms: Schema.Number,
  posts: Schema.Number,
  tags: Schema.Number,
  users: Schema.Number,
}) {}

/** Federated search result. / 联邦搜索结果。 */
export class FederatedSearchResult extends Schema.Class<FederatedSearchResult>("FederatedSearchResult")({
  hits: Schema.Array(FederatedHitDTO),
  totals: FederatedTotalsDTO,
}) {}

/** Meilisearch sync task reference (null while Meilisearch is not connected). / Meilisearch 同步任务引用（未连接时为 null）。 */
export class SyncTaskResult extends Schema.Class<SyncTaskResult>("SyncTaskResult")({
  task: Schema.NullOr(Schema.Unknown),
}) {}

/** Admin key creation / listing result. / 管理员密钥创建/列出结果。 */
export class MeiliKeyResult extends Schema.Class<MeiliKeyResult>("MeiliKeyResult")({
  message: Schema.optional(Schema.String),
  keys: Schema.optional(Schema.Array(Schema.Unknown)),
}) {}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SearchForbidden extends Schema.TaggedErrorClass<SearchForbidden>()(
  "SearchForbidden",
  {},
  { httpApiStatus: 403 },
) {}

// ---------------------------------------------------------------------------
// /meili — Meilisearch search endpoints (public + admin)
// /meili — Meilisearch 搜索端点（公开 + 管理员）
// ---------------------------------------------------------------------------

export class SearchGroup extends HttpApiGroup.make("search")
  // --- Health & status ---
  // --- 健康检查与状态 ---
  .add(
    HttpApiEndpoint.get("health", "/health", {
      success: MeiliHealthResult,
    }),

    HttpApiEndpoint.get("status", "/status", {
      success: MeiliStatusResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),
  )
  // --- Public search ---
  // --- 公开搜索 ---
  .add(
    // POST /meili/content/search — unified content search
    // 统一内容搜索
    HttpApiEndpoint.post("searchContent", "/content/search", {
      payload: Schema.Struct({
        q: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
      }),
      success: UnitSearchResult,
    }),

    // GET /meili/users/search — user search
    // 用户搜索
    HttpApiEndpoint.get("searchUsers", "/users/search", {
      query: Schema.Struct({
        q: Schema.optional(Schema.String),
        ids: Schema.optional(Schema.String),
        offset: Schema.optional(Schema.NumberFromString),
        limit: Schema.optional(Schema.NumberFromString),
        sort: Schema.optional(Schema.String),
      }),
      success: UserSearchResult,
    }),

    // POST /meili/entities/search — entity search
    // 实体搜索
    HttpApiEndpoint.post("searchEntities", "/entities/search", {
      payload: Schema.Struct({
        q: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
      }),
      success: UnitSearchResult,
    }),

    // POST /meili/posts/search — post search
    // 帖子搜索
    HttpApiEndpoint.post("searchPosts", "/posts/search", {
      payload: Schema.Struct({
        q: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
      }),
      success: UnitSearchResult,
    }),

    // POST /meili/polls/search — poll search
    // 投票搜索
    HttpApiEndpoint.post("searchPolls", "/polls/search", {
      payload: Schema.Struct({
        q: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
      }),
      success: UnitSearchResult,
    }),

    // POST /meili/comments/search — comment search
    // 评论搜索
    HttpApiEndpoint.post("searchComments", "/comments/search", {
      payload: Schema.Struct({
        q: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
      }),
      success: CommentSearchResult,
    }),

    // POST /meili/realms/search — realm search
    // Realm 搜索
    HttpApiEndpoint.post("searchRealms", "/realms/search", {
      payload: Schema.Struct({
        q: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
      }),
      success: UnitSearchResult,
    }),

    // POST /meili/zones/search — zone search
    // 专区搜索
    HttpApiEndpoint.post("searchZones", "/zones/search", {
      payload: Schema.Struct({
        q: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
      }),
      success: UnitSearchResult,
    }),

    // POST /meili/tags/search — tag search
    // 标签搜索
    HttpApiEndpoint.post("searchTags", "/tags/search", {
      payload: Schema.Struct({
        q: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
      }),
      success: UnitSearchResult,
    }),

    // POST /meili/labels/search — label search
    // 标签项搜索
    HttpApiEndpoint.post("searchLabels", "/labels/search", {
      payload: Schema.Struct({
        q: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
      }),
      success: UnitSearchResult,
    }),

    // POST /meili/search/federated — federated cross-index search
    // 跨索引联邦搜索
    HttpApiEndpoint.post("searchFederated", "/search/federated", {
      payload: Schema.Struct({
        q: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.Number),
      }),
      success: FederatedSearchResult,
    }).middleware(OptionalAuthMiddleware),
  )
  // --- Admin — index init ---
  // --- 管理员 — 索引初始化 ---
  .add(
    HttpApiEndpoint.post("initContentIndex", "/content/init", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("initUsersIndex", "/users/init", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("initPostsIndex", "/posts/init", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("initPollsIndex", "/polls/init", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("initRealmsIndex", "/realms/init", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("initZonesIndex", "/zones/init", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("initTagsIndex", "/tags/init", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("initLabelsIndex", "/labels/init", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("initEntitiesIndex", "/entities/init", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("initFeedbacksIndex", "/feedbacks/init", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("initProgressIndex", "/progress/init", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),
  )
  // --- Admin — full sync ---
  // --- 管理员 — 全量同步 ---
  .add(
    HttpApiEndpoint.post("syncContent", "/content/sync", {
      success: SyncTaskResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncUsers", "/users/sync", {
      success: SyncTaskResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncPosts", "/posts/sync", {
      success: SyncTaskResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncPolls", "/polls/sync", {
      success: SyncTaskResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncRealms", "/realms/sync", {
      success: SyncTaskResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncZones", "/zones/sync", {
      success: SyncTaskResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncTags", "/tags/sync", {
      success: SyncTaskResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncLabels", "/labels/sync", {
      success: SyncTaskResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncEntities", "/entities/sync", {
      success: SyncTaskResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncFeedbacks", "/feedbacks/sync", {
      success: SyncTaskResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),
  )
  // --- Admin — delete all ---
  // --- 管理员 — 全量删除 ---
  .add(
    HttpApiEndpoint.get("deleteAllContent", "/content/deleteAll", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.delete("deleteAllFeedbacks", "/feedbacks/deleteAll", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.delete("deleteAllUsers", "/users/deleteAll", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.delete("deleteAllPosts", "/posts/deleteAll", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.delete("deleteAllPolls", "/polls/deleteAll", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.delete("deleteAllRealms", "/realms/deleteAll", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.delete("deleteAllZones", "/zones/deleteAll", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.delete("deleteAllEntities", "/entities/deleteAll", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.delete("resetAllIndexes", "/indexes/resetAll", {
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),
  )
  // --- Admin — key management ---
  // --- 管理员 — 密钥管理 ---
  .add(
    HttpApiEndpoint.post("createAdminKey", "/keys/admin", {
      success: MeiliKeyResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.get("listKeys", "/keys", {
      success: MeiliKeyResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.delete("deleteKey", "/keys/:uid", {
      params: { uid: Schema.String },
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),
  )
  .prefix("/meili") {}
