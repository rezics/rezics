import {
  unitProgressListQuerySchema,
  unitProgressListResponseSchema,
  unitProgressParamsSchema,
  unitProgressRowDTOSchema,
  unitProgressStatsResponseSchema,
  unitProgressUpsertBodySchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { mapProgressToDTO } from "./progress.mapper";
import { progressService } from "./progress.service";

export const progressApi = new Elysia()
  .use(authMacro)
  .get(
    "/units/:unitId/progress-stats",
    async ({ params }) => {
      return progressService.progressStats(params.unitId);
    },
    {
      params: unitProgressParamsSchema,
      response: unitProgressStatsResponseSchema,
      detail: {
        summary: "Get aggregate unit progress stats",
        tags: ["Progress"],
      },
    },
  )
  .put(
    "/me/units/:unitId/progress",
    async ({ params, body, identity }) => {
      const row = await progressService.upsert(
        identity.unitId,
        params.unitId,
        body,
      );
      return mapProgressToDTO(row);
    },
    {
      requireLogin: true,
      params: unitProgressParamsSchema,
      body: unitProgressUpsertBodySchema,
      response: unitProgressRowDTOSchema,
      detail: {
        summary: "Upsert my unit progress",
        tags: ["Progress"],
      },
    },
  )
  .get(
    "/me/units/:unitId/progress",
    async ({ params, identity }) => {
      const row = await progressService.get(identity.unitId, params.unitId);
      return row ? mapProgressToDTO(row) : null;
    },
    {
      requireLogin: true,
      params: unitProgressParamsSchema,
      response: t.Nullable(unitProgressRowDTOSchema),
      detail: {
        summary: "Get my unit progress",
        tags: ["Progress"],
      },
    },
  )
  .get(
    "/me/progress",
    async ({ query, identity }) => {
      return progressService.list(identity.unitId, query);
    },
    {
      requireLogin: true,
      query: unitProgressListQuerySchema,
      response: unitProgressListResponseSchema,
      detail: {
        summary: "List my unit progress",
        tags: ["Progress"],
      },
    },
  )
  .delete(
    "/me/units/:unitId/progress",
    async ({ params, identity }) => {
      await progressService.delete(identity.unitId, params.unitId);
      return { message: "Progress deleted" };
    },
    {
      requireLogin: true,
      params: unitProgressParamsSchema,
      response: t.Object({ message: t.String() }),
      detail: {
        summary: "Delete my unit progress",
        tags: ["Progress"],
      },
    },
  );
