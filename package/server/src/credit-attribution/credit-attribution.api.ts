import type { CreditAttributionDTO } from "@rezics/contract";
import {
  BasicAdminPermission,
  linkCreditAttributionSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { creditAttributionService } from "./credit-attribution.service";

export const creditAttributionApi = new Elysia({
  prefix: "/credit-attribution",
})
  .use(authMacro)
  .post(
    "/",
    async ({ body, identity, set }): Promise<CreditAttributionDTO> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      return creditAttributionService.link(body);
    },
    {
      requireLogin: true,
      body: linkCreditAttributionSchema,
      detail: {
        summary: "Link credit attribution",
        description:
          "Link an Entity to a Unit as a creator, contributor, production, publisher, studio, cast, or similar credit.",
        tags: ["Credit Attribution"],
      },
    },
  )
  .get(
    "/by-unit/:unitId",
    async ({ params }): Promise<CreditAttributionDTO[]> => {
      return creditAttributionService.listByUnit(params.unitId);
    },
    {
      params: t.Object({ unitId: t.String() }),
      detail: {
        summary: "List credit attributions for a unit",
        tags: ["Credit Attribution"],
      },
    },
  )
  .delete(
    "/:unitId/:entityId/:role",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      await creditAttributionService.unlink(
        params.unitId,
        params.entityId,
        params.role,
      );
      return { message: "Credit attribution unlinked" };
    },
    {
      requireLogin: true,
      params: t.Object({
        unitId: t.String(),
        entityId: t.String(),
        role: t.String(),
      }),
      detail: {
        summary: "Unlink credit attribution",
        description: "Unlink an Entity credit from a Unit.",
        tags: ["Credit Attribution"],
      },
    },
  );
