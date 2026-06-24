import type { UnitExternalLinkDTO } from "@rezics/contract";
import {
  createUnitExternalLinkSchema,
  type RezicsSessionClaims,
  unitExternalLinkListQuerySchema,
  unitExternalLinkListResponseSchema,
  unitExternalLinkParamsSchema,
  unitExternalLinksBatchBodySchema,
  unitExternalLinksBatchResponseSchema,
  unitExternalLinksResponseSchema,
  updateUnitExternalLinkSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro, isAdminRole, verifyAdminFromDb } from "@/middleware";
import { AppError } from "@/utils/errors";
import { mapUnitExternalLinkToDTO } from "./unit-external-link.mapper";
import { unitExternalLinkService } from "./unit-external-link.service";

async function requireAdmin(identity: RezicsSessionClaims) {
  if (isAdminRole(identity) || (await verifyAdminFromDb(identity.userId))) {
    return;
  }
  throw new AppError(403, "Forbidden: admin permission required");
}

export const unitExternalLinkApi = new Elysia({
  prefix: "/unit-external-link",
})
  .use(authMacro)
  // @convention:root-list-ok
  .get(
    "/",
    async ({
      query,
    }): Promise<{ links: UnitExternalLinkDTO[]; total: number }> => {
      const { rows, total } = await unitExternalLinkService.list(query);
      return { links: rows.map(mapUnitExternalLinkToDTO), total };
    },
    {
      query: unitExternalLinkListQuerySchema,
      response: { 200: unitExternalLinkListResponseSchema },
      detail: {
        summary: "List unit external links",
        tags: ["Unit External Link"],
      },
    },
  )
  .get(
    "/unit/:unitId/links",
    async ({ params, query }) =>
      unitExternalLinkService.externalLinksForUnit(
        params.unitId,
        query.sourceEntityUnitId,
      ),
    {
      query: unitExternalLinkListQuerySchema,
      response: { 200: unitExternalLinksResponseSchema },
      detail: {
        summary: "Get display-ready external links for one Unit",
        tags: ["Unit External Link"],
      },
    },
  )
  .post(
    "/units/links/batch",
    async ({ body }) =>
      unitExternalLinkService.externalLinksForUnits(body.unitIds),
    {
      body: unitExternalLinksBatchBodySchema,
      response: { 200: unitExternalLinksBatchResponseSchema },
      detail: {
        summary: "Get display-ready external links for multiple Units",
        tags: ["Unit External Link"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<UnitExternalLinkDTO> => {
      await requireAdmin(identity);
      const row = await unitExternalLinkService.create(body);
      return mapUnitExternalLinkToDTO(row);
    },
    {
      requireLogin: true,
      body: createUnitExternalLinkSchema,
      detail: {
        summary: "Create unit external link",
        tags: ["Unit External Link"],
      },
    },
  )
  .patch(
    "/:id",
    async ({ params, body, identity }): Promise<UnitExternalLinkDTO> => {
      await requireAdmin(identity);
      const row = await unitExternalLinkService.update(params.id, body);
      return mapUnitExternalLinkToDTO(row);
    },
    {
      requireLogin: true,
      params: unitExternalLinkParamsSchema,
      body: updateUnitExternalLinkSchema,
      detail: {
        summary: "Update unit external link",
        tags: ["Unit External Link"],
      },
    },
  )
  .delete(
    "/:id",
    async ({ params, identity }): Promise<{ message: string }> => {
      await requireAdmin(identity);
      await unitExternalLinkService.delete(params.id);
      return { message: "UnitExternalLink deleted" };
    },
    {
      requireLogin: true,
      params: unitExternalLinkParamsSchema,
      detail: {
        summary: "Delete unit external link",
        tags: ["Unit External Link"],
      },
    },
  );
