import type { UserListQuery } from "@rezics/contract";
import {
  editorialPatchSubmissionSchema,
  hasPermissionToUpdateUser,
  userBySlugParamsSchema,
  userListBodySchema,
  userListQuerySchema,
  userListResponseSchema,
  userParamsSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { mapUserSearchDocToPublicProfile } from "@/meili/mapper";
import { meiliService } from "@/meili/meili.service";
import { authMacro, verifyAdminFromDb } from "@/middleware";
import { assertEditorialPatchAllowed } from "@/unit/collaborative-metadata";
import { mapUserToDTO } from "../models/mapper";
import { userService } from "../service/user.service";
import { userPatchToUpdateUser } from "./user.patch";

function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("User not found:");
}

export const coreRoute = new Elysia()
  .use(authMacro)
  .get(
    "/list",
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
        summary: "Get all users",
        description: "Get all users with filters and pagination",
        tags: ["Users"],
      },
    },
  )
  .post(
    "/list",
    async ({ body }) => {
      const result = await meiliService.searchUsers({
        ...body,
        ids: body.ids?.join(","),
      } as UserListQuery);
      return {
        users: result.users.map(mapUserSearchDocToPublicProfile),
        total: result.total,
      };
    },
    {
      body: userListBodySchema,
      response: { 200: userListResponseSchema },
      detail: {
        summary: "Get all users (POST)",
        description:
          "Get all users via POST body. Use when ids exceed URL length or filters contain nested objects.",
        tags: ["Users"],
      },
    },
  )
  .get(
    "/by-slug/:slug",
    async ({ params, set }) => {
      const user = await userService.getBySlug(params.slug);
      if (!user) {
        set.status = 404;
        return { error: { code: "NOT_FOUND", message: "User not found" } };
      }
      return mapUserToDTO(user);
    },
    {
      params: userBySlugParamsSchema,
      detail: {
        summary: "Get user by slug",
        description: "Look up a user profile by user slug (USER scope)",
        tags: ["Users"],
      },
    },
  )
  .get(
    "/me",
    async ({ identity }) => {
      const user = await userService.getByUserId(identity.userId);
      return mapUserToDTO(user);
    },
    {
      requireLogin: true,
      detail: {
        summary: "Get current user",
        description:
          "Get current authenticated user profile without implicit provisioning.",
        tags: ["Users"],
      },
    },
  )
  .put(
    "/me",
    async ({ identity, body }) => {
      assertEditorialPatchAllowed(body.patch);
      const userReq = userPatchToUpdateUser(body.patch);

      const user = await userService.update(identity.userId, userReq);
      return mapUserToDTO(user);
    },
    {
      requireLogin: true,
      body: editorialPatchSubmissionSchema,
      detail: {
        summary: "Update current user",
        description: "Update current authenticated user profile",
        tags: ["Users"],
      },
    },
  )
  .get(
    "/:userId",
    async ({ params, set }) => {
      try {
        const user = await userService.getByUserId(params.userId);
        return mapUserToDTO(user);
      } catch (error) {
        if (!isRecordNotFoundError(error)) throw error;

        set.status = 404;
        return { error: { code: "NOT_FOUND", message: "User not found" } };
      }
    },
    {
      params: userParamsSchema,
      detail: {
        summary: "Get user by ID",
        description: "Look up a user profile by canonical userId",
        tags: ["Users"],
      },
    },
  )
  .put(
    "/:userId",
    async ({ identity, params, body, status }) => {
      if (
        !hasPermissionToUpdateUser(
          identity.permission,
          identity.userId,
          params.userId,
        )
      ) {
        return status(403, "Forbidden: Cannot update other users");
      }

      assertEditorialPatchAllowed(body.patch);
      const userReq = userPatchToUpdateUser(body.patch);

      const user = await userService.update(params.userId, userReq);
      return mapUserToDTO(user);
    },
    {
      requireLogin: true,
      params: userParamsSchema,
      body: editorialPatchSubmissionSchema,
      response: {
        200: t.Any(),
        403: t.String(),
      },
      detail: {
        summary: "Update user",
        description: "Update a user by unit ID (own profile only)",
        tags: ["Users"],
      },
    },
  )
  .delete(
    "/me",
    async ({ identity, status }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      await userService.delete(identity.userId);
      return { message: "User deleted successfully" };
    },
    {
      requireLogin: true,
      response: {
        200: t.Object({ message: t.String() }),
        403: t.String(),
      },
      detail: {
        summary: "Delete current user",
        description: "Delete current authenticated user account",
        tags: ["Users"],
      },
    },
  )
  .delete(
    "/:userId",
    async ({ identity, params, status }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      await userService.delete(params.userId);
      return { message: "User deleted successfully" };
    },
    {
      requireLogin: true,
      params: userParamsSchema,
      response: {
        200: t.Object({ message: t.String() }),
        403: t.String(),
      },
      detail: {
        summary: "Delete user",
        description: "Delete a user by unit ID (own profile only)",
        tags: ["Users"],
      },
    },
  );
