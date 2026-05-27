import type {
  ContentStructureItem,
  ContentStructureResponse,
  RepresentativeReleaseSelection,
  SeriesContentIndexDTO,
  SeriesDiagnosticsDTO,
  SeriesDetailDTO,
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

const representativeReleaseQuerySchema = t.Object({
  explicitReleaseUnitId: t.Optional(t.String()),
});

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
  )
  .get(
    "/work/:workUnitId/related",
    async ({ params }): Promise<SeriesListResponse> => {
      const result = await seriesService.list({
        relatedWorkUnitId: params.workUnitId,
        limit: 50,
      });
      return { series: result.series.map(mapSeriesToDTO), total: result.total };
    },
    {
      params: t.Object({ workUnitId: t.String() }),
      detail: {
        summary: "List Series related to a work domain",
        tags: ["Series"],
      },
    },
  )
  .get(
    "/representative-release/:workUnitId/suggestions",
    async ({ params, query }): Promise<RepresentativeReleaseSelection> => {
      return seriesService.explainRepresentativeRelease(
        params.workUnitId,
        query.explicitReleaseUnitId,
      );
    },
    {
      params: t.Object({ workUnitId: t.String() }),
      query: representativeReleaseQuerySchema,
      detail: {
        summary: "Explain representative release candidates for a work",
        tags: ["Series"],
      },
    },
  );

export type SeriesApi = typeof seriesApi;
