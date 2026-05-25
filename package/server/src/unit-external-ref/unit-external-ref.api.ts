import type { UnitExternalRefDTO } from "@rezics/contract";
import {
  createUnitExternalRefSchema,
  parsedUnitExternalRefUrlSchema,
  parseUnitExternalRefUrlSchema,
  type RezicsSessionClaims,
  unitExternalRefListQuerySchema,
  unitExternalRefListResponseSchema,
  unitExternalRefParamsSchema,
  updateUnitExternalRefSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro, isAdminRole, verifyAdminFromDb } from "@/middleware";
import { AppError } from "@/utils/errors";
import { mapUnitExternalRefToDTO } from "./unit-external-ref.mapper";
import { unitExternalRefService } from "./unit-external-ref.service";

async function requireAdmin(identity: RezicsSessionClaims) {
  if (isAdminRole(identity) || (await verifyAdminFromDb(identity.userId))) {
    return;
  }
  throw new AppError(403, "Forbidden: admin permission required");
}

export const unitExternalRefApi = new Elysia({
  prefix: "/unit-external-ref",
})
  .use(authMacro)
  // @convention:root-list-ok
  .get(
    "/",
    async ({
      query,
    }): Promise<{ refs: UnitExternalRefDTO[]; total: number }> => {
      const { rows, total } = await unitExternalRefService.list(query);
      return { refs: rows.map(mapUnitExternalRefToDTO), total };
    },
    {
      query: unitExternalRefListQuerySchema,
      response: { 200: unitExternalRefListResponseSchema },
      detail: {
        summary: "List unit external refs",
        tags: ["Unit External Ref"],
      },
    },
  )
  .post(
    "/parse-url",
    async ({ body }) =>
      unitExternalRefService.parseUrl(body.sourceSiteEntityUnitId, body.url),
    {
      body: parseUnitExternalRefUrlSchema,
      response: { 200: parsedUnitExternalRefUrlSchema },
      detail: {
        summary: "Parse a source URL",
        tags: ["Unit External Ref"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<UnitExternalRefDTO> => {
      await requireAdmin(identity);
      const row = await unitExternalRefService.create(body);
      return mapUnitExternalRefToDTO(row);
    },
    {
      requireLogin: true,
      body: createUnitExternalRefSchema,
      detail: {
        summary: "Create unit external ref",
        tags: ["Unit External Ref"],
      },
    },
  )
  .patch(
    "/:id",
    async ({ params, body, identity }): Promise<UnitExternalRefDTO> => {
      await requireAdmin(identity);
      const row = await unitExternalRefService.update(params.id, body);
      return mapUnitExternalRefToDTO(row);
    },
    {
      requireLogin: true,
      params: unitExternalRefParamsSchema,
      body: updateUnitExternalRefSchema,
      detail: {
        summary: "Update unit external ref",
        tags: ["Unit External Ref"],
      },
    },
  )
  .delete(
    "/:id",
    async ({ params, identity }): Promise<{ message: string }> => {
      await requireAdmin(identity);
      await unitExternalRefService.delete(params.id);
      return { message: "UnitExternalRef deleted" };
    },
    {
      requireLogin: true,
      params: unitExternalRefParamsSchema,
      detail: {
        summary: "Delete unit external ref",
        tags: ["Unit External Ref"],
      },
    },
  );
