import type {
  ContentStructureItem,
  ContentStructureResponse,
  SeriesContentIndexDTO,
  SeriesDetailDTO,
  SeriesDiagnosticsDTO,
  SeriesListResponse,
  SeriesResponse,
} from "@rezics/contract";
import {
  createSeriesSchema,
  seriesListBodySchema,
  seriesListQuerySchema,
  seriesParamsSchema,
  updateSeriesSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { mapSeriesToDTO } from "./series.mapper";
import { seriesService } from "./series.service";

export const seriesApi = new Elysia({ prefix: "/series-unit" })
  .use(authMacro)
  .get(
    "/list",
    async ({ query }): Promise<SeriesListResponse> => {
      const result = await seriesService.list(query);
      return { series: result.series.map(mapSeriesToDTO), total: result.total };
    },
    {
      query: seriesListQuerySchema,
      detail: {
        summary: "List Series",
        tags: ["Series"],
      },
    },
  )
  .post(
    "/list",
    async ({ body }): Promise<SeriesListResponse> => {
      const result = await seriesService.list({
        ...body,
        ids: body.ids?.join(","),
      });
      return { series: result.series.map(mapSeriesToDTO), total: result.total };
    },
    {
      body: seriesListBodySchema,
      detail: {
        summary: "List Series by POST body",
        tags: ["Series"],
      },
    },
  )
  .get(
    "/:unitId",
    async ({ params }): Promise<SeriesDetailDTO> => {
      return seriesService.getDetail(params.unitId);
    },
    {
      params: seriesParamsSchema,
      detail: {
        summary: "Get Series detail",
        tags: ["Series"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<SeriesResponse> => {
      const row = await seriesService.create({
        ...body,
        userId: identity.userId,
      });
      return mapSeriesToDTO(row);
    },
    {
      requireLogin: true,
      body: createSeriesSchema,
      detail: {
        summary: "Create Series",
        tags: ["Series"],
      },
    },
  )
  .patch(
    "/:unitId",
    async ({ params, body }): Promise<SeriesResponse> => {
      const row = await seriesService.update(params.unitId, body);
      return mapSeriesToDTO(row);
    },
    {
      requireLogin: true,
      params: seriesParamsSchema,
      body: updateSeriesSchema,
      detail: {
        summary: "Update Series",
        tags: ["Series"],
      },
    },
  )
  .put(
    "/:unitId/content-structure",
    async ({ params, body, identity }): Promise<ContentStructureResponse> => {
      return seriesService.updateContentStructure(
        params.unitId,
        body as ContentStructureItem[],
        identity.userId,
      );
    },
    {
      requireLogin: true,
      params: seriesParamsSchema,
      body: t.Array(t.Any()),
      detail: {
        summary: "Update Series content structure",
        tags: ["Series"],
      },
    },
  )
  .get(
    "/:unitId/content-index",
    async ({ params }): Promise<{ rows: SeriesContentIndexDTO[] }> => {
      return { rows: await seriesService.listContentIndex(params.unitId) };
    },
    {
      params: seriesParamsSchema,
      detail: {
        summary: "List direct Series content index rows",
        tags: ["Series"],
      },
    },
  )
  .get(
    "/:unitId/diagnostics",
    async ({ params }): Promise<SeriesDiagnosticsDTO> => {
      return seriesService.diagnostics(params.unitId);
    },
    {
      params: seriesParamsSchema,
      detail: {
        summary:
          "Inspect Series projection and representative-release diagnostics",
        tags: ["Series"],
      },
    },
  );

export type SeriesApi = typeof seriesApi;
