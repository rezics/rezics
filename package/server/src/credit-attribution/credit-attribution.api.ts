import type { CreditAttributionDTO } from "@rezics/contract";
import {
  createCreditAttributionEvidenceSchema,
  creditAttributionRoleKeySchema,
  linkCreditAttributionSchema,
  type RezicsSessionClaims,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, isAdminRole, verifyAdminFromDb } from "@/middleware";
import { AppError } from "@/utils/errors";
import { creditAttributionService } from "./credit-attribution.service";

async function requireAdmin(identity: RezicsSessionClaims) {
  if (isAdminRole(identity) || (await verifyAdminFromDb(identity.userId))) {
    return;
  }
  throw new AppError(403, "Forbidden: admin permission required");
}

export const creditAttributionApi = new Elysia({
  prefix: "/credit-attribution",
})
  .use(authMacro)
  .post(
    "/",
    async ({ body, identity }): Promise<CreditAttributionDTO> => {
      return creditAttributionService.link(body, identity);
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
  .post(
    "/evidence",
    async ({ body, identity }): Promise<CreditAttributionDTO> => {
      await requireAdmin(identity);
      return creditAttributionService.createEvidence(body);
    },
    {
      requireLogin: true,
      body: createCreditAttributionEvidenceSchema,
      detail: {
        summary: "Create credit attribution evidence",
        tags: ["Credit Attribution"],
      },
    },
  )
  .delete(
    "/:unitId/:entityId/:role",
    async ({ params, identity }): Promise<{ message: string }> => {
      await creditAttributionService.unlink(
        params.unitId,
        params.entityId,
        params.role,
        identity,
      );
      return { message: "Credit attribution unlinked" };
    },
    {
      requireLogin: true,
      params: t.Object({
        unitId: t.String(),
        entityId: t.String(),
        role: creditAttributionRoleKeySchema,
      }),
      detail: {
        summary: "Unlink credit attribution",
        description: "Unlink an Entity credit from a Unit.",
        tags: ["Credit Attribution"],
      },
    },
  );
