import type { UpdateUser } from "@rezics/contract";
import {
  updateUserSchema,
  userListQuerySchema,
  userParamsSchema,
  validateSlug,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, verifyAdminFromDb } from "@/middleware";
import { mapUserToDTO } from "../models/mapper";
import { userService } from "../service/user.service";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

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
        200: t.Any(),
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

      const userReq: UpdateUser = {
        name: body.name,
        avatar: body.avatar,
        bio: body.bio,
        description: body.description,
      };

      const user = await userService.update(params.userId, userReq);

      return mapUserToDTO(user);
    },
    {
      requireLogin: true,
      params: userParamsSchema,
      body: updateUserSchema,
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
  .patch(
    "/admin/:userId/slug",
    async ({ identity, params, body, status }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const validation = validateSlug(body.slug);
      if (!validation.ok) {
        return status(400, {
          error: {
            code: "SLUG_INVALID",
            message: validation.reason,
          },
        });
      }

      try {
        const result = await userService.changeCanonicalSlugAsAdmin(
          params.userId,
          validation.normalized,
        );
        return {
          user: mapUserToDTO(result.user),
          authProjection: result.authProjection,
        };
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return status(409, {
            error: {
              code: "SLUG_TAKEN",
              message: "Slug is already in use",
            },
          });
        }
        throw error;
      }
    },
    {
      requireLogin: true,
      params: userParamsSchema,
      body: t.Object({ slug: t.String({ minLength: 1 }) }),
      response: {
        200: t.Any(),
        400: t.Any(),
        403: t.String(),
        409: t.Any(),
      },
      detail: {
        summary: "Admin update user slug",
        description:
          "Update canonical main user slug and project the login alias to auth.",
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
