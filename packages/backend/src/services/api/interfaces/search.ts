import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware, OptionalAuthMiddleware, Unauthorized } from "./middlewares/auth.ts";

// ---------------------------------------------------------------------------
// Response schemas — minimal placeholders; flesh out when implementing handlers
// 响应 schema —— 最小占位；实现 handler 时再细化
// ---------------------------------------------------------------------------

export class MeiliHealthResult extends Schema.Class<MeiliHealthResult>("MeiliHealthResult")({
  status: Schema.String,
}) {}

export class AdminMessageResult extends Schema.Class<AdminMessageResult>("AdminMessageResult")({
  message: Schema.String,
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
      success: Schema.Any,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),
  )
  // --- Public search ---
  // --- 公开搜索 ---
  .add(
    // POST /meili/content/search — unified content search
    // 统一内容搜索
    HttpApiEndpoint.post("searchContent", "/content/search", {
      payload: Schema.Any,
      success: Schema.Any,
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
      success: Schema.Struct({ users: Schema.Array(Schema.Any), total: Schema.Number }),
    }),

    // POST /meili/entities/search — entity search
    // 实体搜索
    HttpApiEndpoint.post("searchEntities", "/entities/search", {
      payload: Schema.Any,
      success: Schema.Any,
    }),

    // POST /meili/posts/search — post search
    // 帖子搜索
    HttpApiEndpoint.post("searchPosts", "/posts/search", {
      payload: Schema.Any,
      success: Schema.Any,
    }),

    // POST /meili/polls/search — poll search
    // 投票搜索
    HttpApiEndpoint.post("searchPolls", "/polls/search", {
      payload: Schema.Any,
      success: Schema.Any,
    }),

    // POST /meili/comments/search — comment search
    // 评论搜索
    HttpApiEndpoint.post("searchComments", "/comments/search", {
      payload: Schema.Any,
      success: Schema.Any,
    }),

    // POST /meili/realms/search — realm search
    // Realm 搜索
    HttpApiEndpoint.post("searchRealms", "/realms/search", {
      payload: Schema.Any,
      success: Schema.Any,
    }),

    // POST /meili/zones/search — zone search
    // 专区搜索
    HttpApiEndpoint.post("searchZones", "/zones/search", {
      payload: Schema.Any,
      success: Schema.Any,
    }),

    // POST /meili/tags/search — tag search
    // 标签搜索
    HttpApiEndpoint.post("searchTags", "/tags/search", {
      payload: Schema.Any,
      success: Schema.Any,
    }),

    // POST /meili/labels/search — label search
    // 标签项搜索
    HttpApiEndpoint.post("searchLabels", "/labels/search", {
      payload: Schema.Any,
      success: Schema.Any,
    }),

    // POST /meili/search/federated — federated cross-index search
    // 跨索引联邦搜索
    HttpApiEndpoint.post("searchFederated", "/search/federated", {
      payload: Schema.Any,
      success: Schema.Any,
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
      success: Schema.Struct({ task: Schema.Any }),
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncUsers", "/users/sync", {
      success: Schema.Struct({ task: Schema.Any }),
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncPosts", "/posts/sync", {
      success: Schema.Struct({ task: Schema.Any }),
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncPolls", "/polls/sync", {
      success: Schema.Struct({ task: Schema.Any }),
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncRealms", "/realms/sync", {
      success: Schema.Struct({ task: Schema.Any }),
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncZones", "/zones/sync", {
      success: Schema.Struct({ task: Schema.Any }),
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncTags", "/tags/sync", {
      success: Schema.Struct({ task: Schema.Any }),
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncLabels", "/labels/sync", {
      success: Schema.Struct({ task: Schema.Any }),
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncEntities", "/entities/sync", {
      success: Schema.Struct({ task: Schema.Any }),
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("syncFeedbacks", "/feedbacks/sync", {
      success: Schema.Struct({ task: Schema.Any }),
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
      success: Schema.Any,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.get("listKeys", "/keys", {
      success: Schema.Any,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.delete("deleteKey", "/keys/:uid", {
      params: { uid: Schema.String },
      success: AdminMessageResult,
      error: [Unauthorized, SearchForbidden],
    }).middleware(AuthMiddleware),
  )
  .prefix("/meili") {}
