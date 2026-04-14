import type { UpdateUser, UserDTO } from "@rezics/contract";
import {
  updateUserSchema,
  userListQuerySchema,
  userParamsSchema,
} from "@rezics/contract";
import { Elysia, status } from "elysia";
import { authMacro, verifyAdminFromDb } from "@/middleware";
import { mapUserToDTO } from "../model/mapper";
import { userService } from "../service/user.service";

export const adminRoute = new Elysia()
  .use(authMacro)
  .get(
    "/admin",
    async ({ identity, query }): Promise<{ users: UserDTO[]; total: number }> => {
      if (identity.permission.role !== "ADMIN" && identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.unitId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const { users, total } = await userService.list(query as any);
      return { users: users.map(mapUserToDTO), total };
    },
    {
      requireLogin: true,
      query: userListQuerySchema,
      detail: {
        summary: "Admin list users",
        description: "List users for admin",
        tags: ["Users", "Admin"],
      },
    },
  )
  .get(
    "/admin/:unitId",
    async ({ identity, params }): Promise<UserDTO> => {
      if (identity.permission.role !== "ADMIN" && identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.unitId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const user = await userService.getByUnitId(params.unitId);
      return mapUserToDTO(user);
    },
    {
      requireLogin: true,
      params: userParamsSchema,
      detail: {
        summary: "Admin get user",
        description: "Get user detail for admin",
        tags: ["Users", "Admin"],
      },
    },
  )
  .put(
    "/admin/:unitId",
    async ({ identity, params, body }): Promise<UserDTO> => {
      if (identity.permission.role !== "ADMIN" && identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.unitId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

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
        summary: "Admin update user",
        description: "Update user as admin",
        tags: ["Users", "Admin"],
      },
    },
  )
  .delete(
    "/admin/:unitId",
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
        summary: "Admin delete user",
        description: "Delete user as admin",
        tags: ["Users", "Admin"],
      },
    },
  );
