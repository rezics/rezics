import type { UpdateUser, UserDTO, UserListQuery } from "@rezics/contract";
import {
  hasPermissionToUpdateUser,
  updateUserSchema,
  userListQuerySchema,
  userParamsSchema,
} from "@rezics/contract";
import { Elysia, status } from "elysia";
import { mapUserSearchDocToPublicProfile } from "@/meili/mapper";
import { meiliService } from "@/meili/meili.service";
import { authMacro, verifyAdminFromDb } from "@/middleware";
import { mapUserToDTO } from "../model/mapper";
import { userService } from "../service/user.service";

export const coreRoute = new Elysia()
  .use(authMacro)
  .get(
    "/",
    async ({ query }): Promise<{ users: UserDTO[]; total: number }> => {
      const result = await meiliService.searchUsers(query as UserListQuery);
      return {
        users: result.users.map(mapUserSearchDocToPublicProfile),
        total: result.total,
      };
    },
    {
      query: userListQuerySchema,
      detail: {
        summary: "Get all users",
        description: "Get all users with filters and pagination",
        tags: ["Users"],
      },
    },
  )
  .get(
    "/me",
    async ({ identity }): Promise<UserDTO> => {
      const user = await userService.getByUnitId(identity.unitId);
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
    async ({ identity, body }): Promise<UserDTO> => {
      const userReq: UpdateUser = {
        name: body.name,
        avatar: body.avatar,
        bio: body.bio,
      };

      const user = await userService.update(identity.unitId, userReq);
      return mapUserToDTO(user);
    },
    {
      requireLogin: true,
      body: updateUserSchema,
      detail: {
        summary: "Update current user",
        description: "Update current authenticated user profile",
        tags: ["Users"],
      },
    },
  )
  .put(
    "/:unitId",
    async ({ identity, params, body }): Promise<UserDTO> => {
      if (!hasPermissionToUpdateUser(identity.permission, identity.unitId, params.unitId)) {
        return status(403, "Forbidden: Cannot update other users");
      }

      const userReq: UpdateUser = {
        name: body.name,
        avatar: body.avatar,
        bio: body.bio,
        description: body.description,
      };

      const user = await userService.update(params.unitId, userReq);
      return mapUserToDTO(user);
    },
    {
      requireLogin: true,
      params: userParamsSchema,
      body: updateUserSchema,
      detail: {
        summary: "Update user",
        description: "Update a user by unit ID (own profile only)",
        tags: ["Users"],
      },
    },
  )
  .delete(
    "/me",
    async ({ identity }): Promise<{ message: string }> => {
      if (identity.permission.role !== "ADMIN" && identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.unitId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      await userService.delete(identity.unitId);
      return { message: "User deleted successfully" };
    },
    {
      requireLogin: true,
      detail: {
        summary: "Delete current user",
        description: "Delete current authenticated user account",
        tags: ["Users"],
      },
    },
  )
  .delete(
    "/:unitId",
    async ({ identity, params }): Promise<{ message: string }> => {
      if (identity.permission.role !== "ADMIN" && identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.unitId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      await userService.delete(params.unitId);
      return { message: "User deleted successfully" };
    },
    {
      requireLogin: true,
      params: userParamsSchema,
      detail: {
        summary: "Delete user",
        description: "Delete a user by unit ID (own profile only)",
        tags: ["Users"],
      },
    },
  );
