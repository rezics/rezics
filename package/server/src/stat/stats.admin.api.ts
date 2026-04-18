import { adminStatsResponseSchema } from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, verifyAdminFromDb } from "@/middleware/permission";
import { statsService } from "./stats.service";

export const statsAdminApi = new Elysia({ prefix: "/admin/stats" })
  .use(authMacro)
  .get(
    "/",
    async ({ identity, status }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.unitId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      return statsService.getStats();
    },
    {
      requireLogin: true,
      response: {
        200: adminStatsResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Get admin dashboard stats",
        description:
          "Returns aggregate counts, system health, and content trend for the admin dashboard",
        tags: ["Admin", "Stats"],
      },
    },
  );
