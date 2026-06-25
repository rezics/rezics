import type { UpdateUser } from "@rezics/contract";
import {
  editorialPatchSubmissionSchema,
  userListQuerySchema,
  userListResponseSchema,
  userParamsSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, verifyAdminFromDb } from "@/middleware";
import { assertEditorialPatchAllowed } from "@/unit/collaborative-metadata";
import { mapUserToDTO } from "../models/mapper";
import { userService } from "../service/user.service";
import { userPatchToUpdateUser } from "./user.patch";

export const adminRoute = new Elysia()
  .use(authMacro)
  .get(
    "/admin",
    async ({ identity, query, status }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const { users, total } = await userService.list(query as any);
      return { users: users.map((u) => mapUserToDTO(u)), total };
    },
    {
      requireLogin: true,
      query: userListQuerySchema,
      response: {
        200: userListResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Admin list users",
        description: "List users for admin",
        tags: ["Users", "Admin"],
      },
    },
  )
  .get(
    "/admin/:userId",
    async ({ identity, params, status }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const user = await userService.getByUserId(params.userId);
      return mapUserToDTO(user);
    },
    {
      requireLogin: true,
      params: userParamsSchema,
      response: {
        200: t.Any(),
        403: t.String(),
      },
      detail: {
        summary: "Admin get user",
        description: "Get user detail for admin",
        tags: ["Users", "Admin"],
      },
    },
  )
  .put(
    "/admin/:userId",
    async ({ identity, params, body, status }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      assertEditorialPatchAllowed(body.patch);
      const userReq: UpdateUser = userPatchToUpdateUser(body.patch);

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
        summary: "Admin update user",
        description: "Update user as admin",
        tags: ["Users", "Admin"],
      },
    },
  )
  .delete(
    "/admin/:userId",
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
        summary: "Admin delete user",
        description: "Delete user as admin",
        tags: ["Users", "Admin"],
      },
    },
  );
