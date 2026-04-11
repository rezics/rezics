import {
  ContentSearchOptionsSchema,
  type FeedbackListQuery,
  feedbackListQuerySchema,
  isRoot,
  type UserListQuery,
  userListQuerySchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { mapUserSearchDocToPublicProfile } from "./mapper";
import { meiliService } from "./meili.service";
import { searchClient } from "./search-client";

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
  // ANCHOR: Public search endpoints
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
      detail: {
        summary: "Search users (Meilisearch)",
        tags: ["Meili", "Users", "Search"],
      },
    },
  )
  .post(
    "/feedbacks/search",
    async ({ body, currentUser }) => {
      const options = { ...(body as FeedbackListQuery) };
      if (!isRoot(currentUser as any)) {
        options.userId = currentUser.unitId;
      }
      return meiliService.searchFeedbacks(options);
    },
    {
      requireOwner: true,
      body: feedbackListQuerySchema,
      detail: {
        summary: "Search feedbacks (Meilisearch)",
        tags: ["Meili", "Feedback", "Search"],
      },
    },
  )
  // ANCHOR: Admin — index init
  .post(
    "/content/init",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init content index");
      }
      await meiliService.initContentIndex();
      return { message: "content index initialized" };
    },
    {
      requireOwner: true,
      detail: {
        summary: "Init content index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/feedbacks/init",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init feedbacks index");
      }
      await meiliService.initFeedbacksIndex();
      return { message: "feedbacks index initialized" };
    },
    {
      requireOwner: true,
      detail: {
        summary: "Init feedbacks index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/users/init",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init users index");
      }
      await meiliService.initUsersIndex();
      return { message: "users index initialized" };
    },
    {
      requireOwner: true,
      detail: {
        summary: "Init users index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  // ANCHOR: Admin — full sync
  .post(
    "/content/sync",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync content");
      }
      const task = await meiliService.syncAllContent();
      return { task };
    },
    {
      requireOwner: true,
      detail: {
        summary: "Sync all content to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/feedbacks/sync",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync feedbacks");
      }
      const task = await meiliService.syncAllFeedbacks();
      return { task };
    },
    {
      requireOwner: true,
      detail: {
        summary: "Sync all feedbacks to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/users/sync",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync users");
      }
      const task = await meiliService.syncAllUsers();
      return { task };
    },
    {
      requireOwner: true,
      detail: {
        summary: "Sync all users to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  // ANCHOR: Admin — dangerous operations
  .get(
    "/content/deleteAll",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all content");
      }
      await searchClient.deleteAllContent();
      return { message: "all content deleted" };
    },
    {
      requireOwner: true,
      detail: {
        summary: "Delete all content from Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  // ANCHOR: Admin — key management
  .post(
    "/keys/admin",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to create admin key");
      }
      return meiliService.createAdminKey();
    },
    {
      requireOwner: true,
      detail: {
        summary: "Create admin API key",
        tags: ["Meili", "Keys", "Admin"],
      },
    },
  )
  .get(
    "/keys",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to list keys");
      }
      return meiliService.listKeys();
    },
    {
      requireOwner: true,
      detail: {
        summary: "List Meilisearch keys",
        tags: ["Meili", "Keys", "Admin"],
      },
    },
  )
  .delete(
    "/keys/:uid",
    async ({ params, currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete key");
      }
      await meiliService.deleteKey(params.uid);
      return { message: "key deleted" };
    },
    {
      requireOwner: true,
      params: t.Object({
        uid: t.String(),
      }),
      detail: {
        summary: "Delete Meilisearch key",
        tags: ["Meili", "Keys", "Admin"],
      },
    },
  );
