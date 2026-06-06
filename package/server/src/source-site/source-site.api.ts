import type { SourceSiteDTO } from "@rezics/contract";
import {
  createSourceSiteSchema,
  type RezicsSessionClaims,
  sourceSiteListQuerySchema,
  sourceSiteListResponseSchema,
  sourceSiteParamsSchema,
  updateSourceSiteSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro, isAdminRole, verifyAdminFromDb } from "@/middleware";
import { AppError } from "@/utils/errors";
import { mapSourceSiteToDTO } from "./source-site.mapper";
import { sourceSiteService } from "./source-site.service";

async function requireAdmin(identity: RezicsSessionClaims) {
  if (isAdminRole(identity) || (await verifyAdminFromDb(identity.userId))) {
    return;
  }
  throw new AppError(403, "Forbidden: admin permission required");
}

export const sourceSiteApi = new Elysia({ prefix: "/source-site" })
  .use(authMacro)
  // @convention:root-list-ok
  .get(
    "/",
    async ({
      query,
    }): Promise<{ sourceSites: SourceSiteDTO[]; total: number }> => {
      const { rows, total } = await sourceSiteService.list(query);
      return { sourceSites: rows.map(mapSourceSiteToDTO), total };
    },
    {
      query: sourceSiteListQuerySchema,
      response: { 200: sourceSiteListResponseSchema },
      detail: {
        summary: "List source sites",
        tags: ["Source Site"],
      },
    },
  )
  .get(
    "/:entityUnitId",
    async ({ params, set }) => {
      const row = await sourceSiteService.getByEntityUnitId(
        params.entityUnitId,
      );
      if (!row) {
        set.status = 404;
        return {
          error: { code: "NOT_FOUND", message: "SourceSite not found" },
        };
      }
      return mapSourceSiteToDTO(row);
    },
    {
      params: sourceSiteParamsSchema,
      detail: {
        summary: "Get source site",
        tags: ["Source Site"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<SourceSiteDTO> => {
      await requireAdmin(identity);
      const row = await sourceSiteService.create(body);
      return mapSourceSiteToDTO(row);
    },
    {
      requireLogin: true,
      body: createSourceSiteSchema,
      detail: {
        summary: "Create source site",
        tags: ["Source Site"],
      },
    },
  )
  .patch(
    "/:entityUnitId",
    async ({ params, body, identity }): Promise<SourceSiteDTO> => {
      await requireAdmin(identity);
      const row = await sourceSiteService.update(params.entityUnitId, body);
      return mapSourceSiteToDTO(row);
    },
    {
      requireLogin: true,
      params: sourceSiteParamsSchema,
      body: updateSourceSiteSchema,
      detail: {
        summary: "Update source site",
        tags: ["Source Site"],
      },
    },
  )
  .delete(
    "/:entityUnitId",
    async ({ params, identity }): Promise<{ message: string }> => {
      await requireAdmin(identity);
      await sourceSiteService.delete(params.entityUnitId);
      return { message: "SourceSite deleted" };
    },
    {
      requireLogin: true,
      params: sourceSiteParamsSchema,
      detail: {
        summary: "Delete source site",
        tags: ["Source Site"],
      },
    },
  );
