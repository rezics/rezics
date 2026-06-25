import {
  CommentSearchOptionsSchema,
  ContentSearchOptionsSchema,
  EntitySearchOptionsSchema,
  type FeedbackListQuery,
  feedbackListQuerySchema,
  isRoot,
  LabelSearchOptionsSchema,
  PollSearchOptionsSchema,
  PostSearchOptionsSchema,
  RealmSearchOptionsSchema,
  TagSearchOptionsSchema,
  type UserListQuery,
  userListQuerySchema,
  userListResponseSchema,
  ZoneSearchOptionsSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import {
  authMacro,
  isAdminRole,
  verifyAdminFromDb,
  verifyRootFromDb,
} from "@/middleware";
import { mapUserSearchDocToPublicProfile } from "./mapper";
import { meiliService } from "./meili.service";
import { searchClient } from "./search-client";
import { getMeiliStatusSummary } from "./status.service";

export const meiliApi = new Elysia({ prefix: "/meili" })
  .use(authMacro)
  .get(
    "/health",
    async () => {
      const ok = await searchClient.checkHealth();
      return { status: ok ? "available" : "unavailable" };
    },
    {
      detail: {
        summary: "Meilisearch health check",
        tags: ["Meili"],
      },
    },
  )
  .get(
    "/status",
    async ({ identity, set }) => {
      if (!isAdminRole(identity)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      return getMeiliStatusSummary();
    },
    {
      requireLogin: true,
      detail: {
        summary: "Meili status summary",
        tags: ["Meili", "Admin", "Status"],
      },
    },
  )
  // ANCHOR: Public search endpoints
  // ANCHOR: 公开搜索端点
  .post(
    "/content/search",
    async ({ body }) => {
      return meiliService.searchContent(body);
    },
    {
      body: ContentSearchOptionsSchema,
      detail: {
        summary: "Search content (Meilisearch)",
        description:
          "Unified full-text search over all content types (books, games, media, shelves).",
        tags: ["Meili", "Content", "Search"],
      },
    },
  )
  .get(
    "/users/search",
    async ({ query }) => {
      const result = await meiliService.searchUsers(query as UserListQuery);
      return {
        users: result.users.map(mapUserSearchDocToPublicProfile),
        total: result.total,
      };
    },
    {
      query: userListQuerySchema,
      response: { 200: userListResponseSchema },
      detail: {
        summary: "Search users (Meilisearch)",
        tags: ["Meili", "Users", "Search"],
      },
    },
  )
  .post(
    "/entities/search",
    async ({ body }) => {
      return meiliService.searchEntities(body);
    },
    {
      body: EntitySearchOptionsSchema,
      detail: {
        summary: "Search entities (Meilisearch)",
        description:
          "Full-text search over Entity identity with kind, owner, verified, and attribution role facets.",
        tags: ["Meili", "Entities", "Search"],
      },
    },
  )
  .post(
    "/feedbacks/search",
    async ({ body, identity }) => {
      const options = { ...(body as FeedbackListQuery) };
      if (!isRoot(identity.permission)) {
        options.userId = identity.userId;
      }
      return meiliService.searchFeedbacks(options);
    },
    {
      requireLogin: true,
      body: feedbackListQuerySchema,
      detail: {
        summary: "Search feedbacks (Meilisearch)",
        tags: ["Meili", "Feedback", "Search"],
      },
    },
  )
  .post(
    "/posts/search",
    async ({ body }) => {
      return meiliService.searchPosts(body);
    },
    {
      body: PostSearchOptionsSchema,
      detail: {
        summary: "Search posts (Meilisearch)",
        description:
          "Full-text search over posts with filters for kind, target, realm, author, depth.",
        tags: ["Meili", "Posts", "Search"],
      },
    },
  )
  .post(
    "/polls/search",
    async ({ body }) => {
      return meiliService.searchPolls(body);
    },
    {
      body: PollSearchOptionsSchema,
      detail: {
        summary: "Search polls (Meilisearch)",
        description:
          "Full-text search over reusable polls with usage and lifecycle filters.",
        tags: ["Meili", "Polls", "Search"],
      },
    },
  )
  .post(
    "/comments/search",
    async ({ body }) => {
      return meiliService.searchComments(body);
    },
    {
      body: CommentSearchOptionsSchema,
      detail: {
        summary: "Search comments (Meilisearch)",
        description:
          "Full-text search over comments partitioned by root unit and realm.",
        tags: ["Meili", "Comments", "Search"],
      },
    },
  )
  .post(
    "/realms/search",
    async ({ body }) => {
      return meiliService.searchRealms(body);
    },
    {
      body: RealmSearchOptionsSchema,
      detail: {
        summary: "Search realms (Meilisearch)",
        description:
          "Full-text search over realms with filters for public/official status.",
        tags: ["Meili", "Realms", "Search"],
      },
    },
  )
  .post(
    "/zones/search",
    async ({ body }) => {
      return meiliService.searchZones(body);
    },
    {
      body: ZoneSearchOptionsSchema,
      detail: {
        summary: "Search zones (Meilisearch)",
        description:
          "Full-text search over zones with owner realm, language, and lifecycle metadata.",
        tags: ["Meili", "Zones", "Search"],
      },
    },
  )
  .post(
    "/tags/search",
    async ({ body }) => {
      return meiliService.searchTags(body);
    },
    {
      body: TagSearchOptionsSchema,
      detail: {
        summary: "Search tags (Meilisearch)",
        description: "Full-text search over global multilingual TAG units.",
        tags: ["Meili", "Tags", "Search"],
      },
    },
  )
  .post(
    "/labels/search",
    async ({ body }) => {
      return meiliService.searchLabels(body);
    },
    {
      body: LabelSearchOptionsSchema,
      detail: {
        summary: "Search labels (Meilisearch)",
        description:
          "Full-text search over global multilingual LABEL units used as shared i18n references.",
        tags: ["Meili", "Labels", "Search"],
      },
    },
  )
  // ANCHOR: Admin — index init
  // ANCHOR: 管理员 — 索引初始化
  .post(
    "/content/init",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init content index");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init content index");
      }
      await meiliService.initContentIndex();
      return { message: "content index initialized" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Init content index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/feedbacks/init",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init feedbacks index");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init feedbacks index");
      }
      await meiliService.initFeedbacksIndex();
      return { message: "feedbacks index initialized" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Init feedbacks index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/users/init",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init users index");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init users index");
      }
      await meiliService.initUsersIndex();
      return { message: "users index initialized" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Init users index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/posts/init",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init posts index");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init posts index");
      }
      await meiliService.initPostsIndex();
      return { message: "posts index initialized" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Init posts index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/polls/init",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init polls index");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init polls index");
      }
      await meiliService.initPollsIndex();
      return { message: "polls index initialized" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Init polls index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/realms/init",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init realms index");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init realms index");
      }
      await meiliService.initRealmsIndex();
      return { message: "realms index initialized" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Init realms index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/zones/init",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init zones index");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init zones index");
      }
      await meiliService.initZonesIndex();
      return { message: "zones index initialized" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Init zones index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/tags/init",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init tags index");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init tags index");
      }
      await meiliService.initTagsIndex();
      return { message: "tags index initialized" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Init tags index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/labels/init",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init labels index");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init labels index");
      }
      await meiliService.initLabelsIndex();
      return { message: "labels index initialized" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Init labels index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/entities/init",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init entities index");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init entities index");
      }
      await meiliService.initEntitiesIndex();
      return { message: "entities index initialized" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Init entities index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/progress/init",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init progress index");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init progress index");
      }
      await meiliService.initProgressIndex();
      return { message: "progress index initialized" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Init progress index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  // ANCHOR: Admin — full sync
  // ANCHOR: 管理员 — 全量同步
  .post(
    "/content/sync",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync content");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync content");
      }
      const task = await meiliService.syncAllContent();
      return { task };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Sync all content to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/feedbacks/sync",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync feedbacks");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync feedbacks");
      }
      const task = await meiliService.syncAllFeedbacks();
      return { task };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Sync all feedbacks to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/users/sync",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync users");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync users");
      }
      const task = await meiliService.syncAllUsers();
      return { task };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Sync all users to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/posts/sync",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync posts");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync posts");
      }
      const task = await meiliService.syncAllPosts();
      return { task };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Sync all posts to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/polls/sync",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync polls");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync polls");
      }
      const task = await meiliService.syncAllPolls();
      return { task };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Sync all polls to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/realms/sync",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync realms");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync realms");
      }
      const task = await meiliService.syncAllRealms();
      return { task };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Sync all realms to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/zones/sync",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync zones");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync zones");
      }
      const task = await meiliService.syncAllZones();
      return { task };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Sync all zones to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/tags/sync",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync tags");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync tags");
      }
      const task = await meiliService.syncAllTags();
      return { task };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Sync all tags to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/labels/sync",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync labels");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync labels");
      }
      const task = await meiliService.syncAllLabels();
      return { task };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Sync all labels to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/entities/sync",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync entities");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync entities");
      }
      const task = await meiliService.syncAllEntities();
      return { task };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Sync all entities to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  // ANCHOR: Admin — dangerous operations
  // ANCHOR: 管理员 — 危险操作
  .get(
    "/content/deleteAll",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all content");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all content");
      }
      await searchClient.deleteAllContent();
      return { message: "all content deleted" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Delete all content from Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .delete(
    "/feedbacks/deleteAll",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all feedbacks");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all feedbacks");
      }
      await meiliService.deleteAllFeedbacks();
      return { message: "all feedbacks deleted" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Delete all feedbacks from Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .delete(
    "/users/deleteAll",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all users");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all users");
      }
      await meiliService.deleteAllUsers();
      return { message: "all users deleted" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Delete all users from Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .delete(
    "/posts/deleteAll",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all posts");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all posts");
      }
      await meiliService.deleteAllPosts();
      return { message: "all posts deleted" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Delete all posts from Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .delete(
    "/polls/deleteAll",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all polls");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all polls");
      }
      await meiliService.deleteAllPolls();
      return { message: "all polls deleted" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Delete all polls from Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .delete(
    "/realms/deleteAll",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all realms");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all realms");
      }
      await meiliService.deleteAllRealms();
      return { message: "all realms deleted" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Delete all realms from Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .delete(
    "/zones/deleteAll",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all zones");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all zones");
      }
      await meiliService.deleteAllZones();
      return { message: "all zones deleted" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Delete all zones from Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .delete(
    "/entities/deleteAll",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all entities");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all entities");
      }
      await meiliService.deleteAllEntities();
      return { message: "all entities deleted" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Delete all entities from Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .delete(
    "/indexes/resetAll",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to reset all indexes");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to reset all indexes");
      }
      await meiliService.deleteAllIndexes();
      return { message: "all indexes deleted" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Delete all Meilisearch indexes (nuclear reset)",
        tags: ["Meili", "Admin"],
      },
    },
  )
  // ANCHOR: Admin — key management
  // ANCHOR: 管理员 — 密钥管理
  .post(
    "/keys/admin",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to create admin key");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to create admin key");
      }
      return meiliService.createAdminKey();
    },
    {
      requireLogin: true,
      detail: {
        summary: "Create admin API key",
        tags: ["Meili", "Keys", "Admin"],
      },
    },
  )
  .get(
    "/keys",
    async ({ identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to list keys");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to list keys");
      }
      return meiliService.listKeys();
    },
    {
      requireLogin: true,
      detail: {
        summary: "List Meilisearch keys",
        tags: ["Meili", "Keys", "Admin"],
      },
    },
  )
  .delete(
    "/keys/:uid",
    async ({ params, identity, set }) => {
      if (!isRoot(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete key");
      }
      const isRootUser = await verifyRootFromDb(identity.userId);
      if (!isRootUser) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete key");
      }
      await meiliService.deleteKey(params.uid);
      return { message: "key deleted" };
    },
    {
      requireLogin: true,
      params: t.Object({
        uid: t.String(),
      }),
      detail: {
        summary: "Delete Meilisearch key",
        tags: ["Meili", "Keys", "Admin"],
      },
    },
  );
