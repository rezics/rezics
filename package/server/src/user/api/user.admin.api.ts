import type { UpdateUser, UserDTO } from "@rezics/contract";
import {
  updateUserSchema,
  userListQuerySchema,
  userParamsSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import { invalidate as invalidateUserCache } from "@/middleware/user-cache";
import { mapUserToDTO } from "../model/mapper";
import { userService } from "../service/user.service";

export const adminRoute = new Elysia()
  .use(authMacro)
  .get(
    "/admin",
    async ({ query }): Promise<{ users: UserDTO[]; total: number }> => {
      const { users, total } = await userService.list(query as any);
      return { users: users.map(mapUserToDTO), total };
    },
    {
      requireAdmin: true,
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
    async ({ params }): Promise<UserDTO> => {
      const user = await userService.getByUnitId(params.unitId);
      return mapUserToDTO(user);
    },
    {
      requireAdmin: true,
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
    async ({ params, body }): Promise<UserDTO> => {
      const userReq: UpdateUser = {
        name: body.name,
        avatar: body.avatar,
        bio: body.bio,
        description: body.description,
      };

      const user = await userService.update(params.unitId, userReq);
      invalidateUserCache(params.unitId);
      return mapUserToDTO(user);
    },
    {
      requireAdmin: true,
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
    async ({ params }): Promise<{ message: string }> => {
      await userService.delete(params.unitId);
      invalidateUserCache(params.unitId);
      return { message: "User deleted successfully" };
    },
    {
      requireAdmin: true,
      params: userParamsSchema,
      detail: {
        summary: "Admin delete user",
        description: "Delete user as admin",
        tags: ["Users", "Admin"],
      },
    },
  );
