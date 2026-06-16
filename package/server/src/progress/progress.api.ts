import {
  continueReadingListQuerySchema,
  continueReadingListResponseSchema,
  nodeCompletionToggleBodySchema,
  progressLibraryListResponseSchema,
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
        identity.userId,
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
      const row = await progressService.get(identity.userId, params.unitId);
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
      return progressService.list(identity.userId, query);
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
  .get(
    "/me/progress/continue-reading",
    async ({ query, identity }) => {
      // This endpoint is intentionally `/me`-scoped: reading progress stays
      // viewer-owned until a public progress/privacy model exists.
      return progressService.continueReading(identity.userId, query);
    },
    {
      requireLogin: true,
      query: continueReadingListQuerySchema,
      response: continueReadingListResponseSchema,
      detail: {
        summary: "List my continue-reading items",
        tags: ["Progress"],
      },
    },
  )
  .get(
    "/me/progress/library",
    async ({ query, identity }) => {
      return progressService.listLibrary(identity.userId, query);
    },
    {
      requireLogin: true,
      query: unitProgressListQuerySchema,
      response: progressLibraryListResponseSchema,
      detail: {
        summary: "List my hydrated progress library",
        tags: ["Progress"],
      },
    },
  )
  .delete(
    "/me/units/:unitId/progress",
    async ({ params, identity }) => {
      await progressService.delete(identity.userId, params.unitId);
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
  )
  .post(
    "/me/units/:unitId/node-completion",
    async ({ params, body, identity }) => {
      await progressService.toggleNodeCompletion(
        identity.userId,
        params.unitId,
        body.nodeId,
        body.isCompleted,
      );
      return { message: "Node completion updated" };
    },
    {
      requireLogin: true,
      params: unitProgressParamsSchema,
      body: nodeCompletionToggleBodySchema,
      response: t.Object({ message: t.String() }),
      detail: {
        summary: "Toggle completion of a content structure node",
        tags: ["Progress"],
      },
    },
  );
