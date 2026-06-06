import {
  singleStructureEventResponseSchema,
  singleUnitRevisionResponseSchema,
  structureEventTimelinePageSchema,
  unitRevisionPathCompareResponseSchema,
  unitRevisionTimelinePageSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { revisionService } from "./revision.service";

const unitRevisionParamsSchema = t.Object({
  unitId: t.String(),
});

const singleRevisionParamsSchema = t.Object({
  unitId: t.String(),
  sequence: t.Numeric(),
});

const compareRevisionParamsSchema = t.Object({
  unitId: t.String(),
  baseSequence: t.Numeric(),
  targetSequence: t.Numeric(),
});

const singleStructureEventParamsSchema = t.Object({
  unitId: t.String(),
  sequence: t.Numeric(),
  eventType: t.String(),
});

export const revisionApi = new Elysia({ prefix: "/history" })
  .get(
    "/unit/:unitId/revisions",
    async ({ params, query }) =>
      revisionService.listUnitRevisions({
        unitId: params.unitId,
        limit: Number(query.limit ?? 20),
        cursor: query.cursor ?? null,
        includeContent: query.includeContent ?? false,
      }),
    {
      params: unitRevisionParamsSchema,
      query: t.Object({
        limit: t.Optional(t.Numeric()),
        cursor: t.Optional(t.String()),
        includeContent: t.Optional(t.Boolean()),
      }),
      response: unitRevisionTimelinePageSchema,
      detail: {
        summary: "List Unit revision timeline",
        tags: ["History"],
      },
    },
  )
  .get(
    "/unit/:unitId/revisions/:sequence",
    async ({ params, query, set }) => {
      const revision = await revisionService.getUnitRevision({
        unitId: params.unitId,
        sequence: Number(params.sequence),
        includeContent: query.includeContent ?? true,
      });
      if (!revision) {
        set.status = 404;
        return { message: "Revision not found" };
      }
      return { revision };
    },
    {
      params: singleRevisionParamsSchema,
      query: t.Object({
        includeContent: t.Optional(t.Boolean()),
      }),
      response: {
        200: singleUnitRevisionResponseSchema,
        404: t.Object({ message: t.String() }),
      },
      detail: {
        summary: "Get single Unit revision",
        tags: ["History"],
      },
    },
  )
  .get(
    "/unit/:unitId/revisions/compare/:baseSequence/:targetSequence",
    async ({ params }) =>
      revisionService.compareRevisionPaths({
        unitId: params.unitId,
        baseSequence: Number(params.baseSequence),
        targetSequence: Number(params.targetSequence),
      }),
    {
      params: compareRevisionParamsSchema,
      response: unitRevisionPathCompareResponseSchema,
      detail: {
        summary: "Compare Unit revisions by path snapshots",
        tags: ["History"],
      },
    },
  )
  .get(
    "/unit/:unitId/structure-events",
    async ({ params, query }) =>
      revisionService.listStructureEvents({
        unitId: params.unitId,
        limit: Number(query.limit ?? 50),
        cursor: query.cursor ?? null,
        eventType: query.eventType ?? null,
        includePayload: query.includePayload ?? false,
      }),
    {
      params: unitRevisionParamsSchema,
      query: t.Object({
        limit: t.Optional(t.Numeric()),
        cursor: t.Optional(t.String()),
        eventType: t.Optional(t.String()),
        includePayload: t.Optional(t.Boolean()),
      }),
      response: structureEventTimelinePageSchema,
      detail: {
        summary: "List Unit structure events",
        tags: ["History"],
      },
    },
  )
  .get(
    "/unit/:unitId/structure-events/:sequence/:eventType",
    async ({ params, query, set }) => {
      const event = await revisionService.getStructureEvent({
        unitId: params.unitId,
        sequence: Number(params.sequence),
        eventType: params.eventType,
        includePayload: query.includePayload ?? true,
      });
      if (!event) {
        set.status = 404;
        return { message: "Structure event not found" };
      }
      return { event };
    },
    {
      params: singleStructureEventParamsSchema,
      query: t.Object({
        includePayload: t.Optional(t.Boolean()),
      }),
      response: {
        200: singleStructureEventResponseSchema,
        404: t.Object({ message: t.String() }),
      },
      detail: {
        summary: "Get single Unit structure event",
        tags: ["History"],
      },
    },
  );
