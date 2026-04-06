import {
  type BookQueryOptions,
  bookQueryOptionsSchema,
  type FeedbackListQuery,
  feedbackListQuerySchema,
  isRoot,
  type ReadlistListQuery,
  readlistListQuerySchema,
  type UnitListQuery,
  type UserListQuery,
  unitListQuerySchema,
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
  .post(
    "/books/search",
    async ({ body }) => {
      return meiliService.searchBooks(body as BookQueryOptions);
    },
    {
      body: bookQueryOptionsSchema,
      detail: {
        summary: "Search books (Meilisearch)",
        description:
          "Full-text search over books using Meilisearch, driven by contract-based BookQueryOptions.",
        tags: ["Meili", "Books", "Search"],
      },
    },
  )
  .post(
    "/readlists/search",
    async ({ body }) => {
      return meiliService.searchReadlists(body as ReadlistListQuery);
    },
    {
      body: readlistListQuerySchema,
      detail: {
        summary: "Search readlists (Meilisearch)",
        description:
          "Full-text search over readlists using Meilisearch, driven by contract-based ReadlistListQuery.",
        tags: ["Meili", "Readlists", "Search"],
      },
    },
  )
  .get(
    "/units/search",
    async ({ query }) => {
      return meiliService.searchUnits(query as UnitListQuery);
    },
    {
      query: unitListQuerySchema,
      detail: {
        summary: "Search units (Meilisearch)",
        description:
          "Full-text search over generic units using Meilisearch, driven by contract-based UnitListQuery.",
        tags: ["Meili", "Units", "Search"],
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
        description:
          "Full-text search over users using Meilisearch, driven by contract-based UserListQuery.",
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
        description:
          "Search feedbacks using Meilisearch with filters, respecting admin and non-admin permissions.",
        tags: ["Meili", "Feedback", "Search"],
      },
    },
  )
  .post(
    "/books/init",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: You are not authorized to init books index",
        );
      }
      await meiliService.initBooksIndex();
      return { message: "books index initialized" };
    },
    {
      requireOwner: true,
      detail: {
        summary: "Init books index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/readlists/init",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: You are not authorized to init readlists index",
        );
      }
      await meiliService.initReadlistsIndex();
      return { message: "readlists index initialized" };
    },
    {
      requireOwner: true,
      detail: {
        summary: "Init readlists index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/feedbacks/init",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: You are not authorized to init feedbacks index",
        );
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
    "/units/init",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: You are not authorized to init units index",
        );
      }
      await meiliService.initUnitsIndex();
      return { message: "units index initialized" };
    },
    {
      requireOwner: true,
      detail: {
        summary: "Init units index",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/users/init",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: You are not authorized to init users index",
        );
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
  .post(
    "/books/sync",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error("Forbidden: You are not authorized to sync all books");
      }
      const task = await meiliService.syncAllBooks();
      return { task };
    },
    {
      requireOwner: true,
      detail: {
        summary: "Sync all books to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/readlists/sync",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: You are not authorized to sync all readlists",
        );
      }
      const task = await meiliService.syncAllReadlists();
      return { task };
    },
    {
      requireOwner: true,
      detail: {
        summary: "Sync all readlists to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/feedbacks/sync",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: You are not authorized to sync all feedbacks",
        );
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
    "/units/sync",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error("Forbidden: You are not authorized to sync all units");
      }
      const task = await meiliService.syncAllUnits();
      return { task };
    },
    {
      requireOwner: true,
      detail: {
        summary: "Sync all units to Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/users/sync",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error("Forbidden: You are not authorized to sync all users");
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
  .get(
    "/units/deleteAllUnits",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: You are not authorized to delete all units",
        );
      }
      await searchClient.deleteAllUnits();
      return { message: "all units deleted" };
    },
    {
      requireOwner: true,
      detail: {
        summary: "Delete all units from Meilisearch",
        tags: ["Meili", "Admin"],
      },
    },
  )
  .post(
    "/keys/search",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: You are not authorized to create search key",
        );
      }
      const key = await meiliService.createSearchKey();
      return { key };
    },
    {
      requireOwner: true,
      detail: {
        summary: "Create search-only API key",
        tags: ["Meili", "Keys"],
      },
    },
  )
  .post(
    "/keys/admin",
    async ({ currentUser, set }) => {
      if (!isRoot(currentUser as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: You are not authorized to create admin key",
        );
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
        throw new Error("Forbidden: You are not authorized to list keys");
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
        throw new Error("Forbidden: You are not authorized to delete key");
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
