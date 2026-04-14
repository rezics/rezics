import {
  ContentSearchOptionsSchema,
  type FeedbackListQuery,
  feedbackListQuerySchema,
  isRoot,
  type UserListQuery,
  userListQuerySchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, verifyRootFromDb } from "@/middleware";
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
    async ({ body, identity }) => {
      const options = { ...(body as FeedbackListQuery) };
      if (!isRoot(identity)) {
        options.userId = identity.unitId;
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
  // ANCHOR: Admin — index init
  .post(
    "/content/init",
    async ({ identity, set }) => {
      if (!isRoot(identity)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init content index");
      }
      const isRootUser = await verifyRootFromDb(identity.unitId);
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
      if (!isRoot(identity)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init feedbacks index");
      }
      const isRootUser = await verifyRootFromDb(identity.unitId);
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
      if (!isRoot(identity)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to init users index");
      }
      const isRootUser = await verifyRootFromDb(identity.unitId);
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
  // ANCHOR: Admin — full sync
  .post(
    "/content/sync",
    async ({ identity, set }) => {
      if (!isRoot(identity)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync content");
      }
      const isRootUser = await verifyRootFromDb(identity.unitId);
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
      if (!isRoot(identity)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync feedbacks");
      }
      const isRootUser = await verifyRootFromDb(identity.unitId);
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
      if (!isRoot(identity)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to sync users");
      }
      const isRootUser = await verifyRootFromDb(identity.unitId);
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
  // ANCHOR: Admin — dangerous operations
  .get(
    "/content/deleteAll",
    async ({ identity, set }) => {
      if (!isRoot(identity)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all content");
      }
      const isRootUser = await verifyRootFromDb(identity.unitId);
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
      if (!isRoot(identity)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all feedbacks");
      }
      const isRootUser = await verifyRootFromDb(identity.unitId);
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
      if (!isRoot(identity)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete all users");
      }
      const isRootUser = await verifyRootFromDb(identity.unitId);
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
    "/indexes/resetAll",
    async ({ identity, set }) => {
      if (!isRoot(identity)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to reset all indexes");
      }
      const isRootUser = await verifyRootFromDb(identity.unitId);
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
  .post(
    "/keys/admin",
    async ({ identity, set }) => {
      if (!isRoot(identity)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to create admin key");
      }
      const isRootUser = await verifyRootFromDb(identity.unitId);
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
      if (!isRoot(identity)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to list keys");
      }
      const isRootUser = await verifyRootFromDb(identity.unitId);
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
      if (!isRoot(identity)) {
        set.status = 403;
        throw new Error("Forbidden: not authorized to delete key");
      }
      const isRootUser = await verifyRootFromDb(identity.unitId);
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
