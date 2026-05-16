import type { AttributionDTO } from "@rezics/contract";
import { BasicAdminPermission, linkAttributionSchema } from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { attributionService } from "./attribution.service";

export const attributionApi = new Elysia({ prefix: "/attribution" })
  .use(authMacro)
  // --- Credit link routes ---
  .post(
    "/credits",
    async ({ body, identity, set }): Promise<AttributionDTO> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      return attributionService.linkAttribution(body);
    },
    {
      requireLogin: true,
      body: linkAttributionSchema,
      detail: {
        summary: "Link attribution",
        description: "Link an entity to a unit with a role (admin only)",
        tags: ["Attribution"],
      },
    },
  )
  .delete(
    "/credits/:unitId/:entityId/:role",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      await attributionService.unlinkAttribution(
        params.unitId,
        params.entityId,
        params.role,
      );
      return { message: "Attribution unlinked" };
    },
    {
      requireLogin: true,
      params: t.Object({
        unitId: t.String(),
        entityId: t.String(),
        role: t.String(),
      }),
      detail: {
        summary: "Unlink attribution",
        description: "Unlink an entity from a unit (admin only)",
        tags: ["Attribution"],
      },
    },
  );

export default attributionApi;
