import {
  singleStructureEventResponseSchema,
  singleUnitRevisionResponseSchema,
  structureEventTimelinePageSchema,
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
      }),
    {
      params: unitRevisionParamsSchema,
      query: t.Object({
        limit: t.Optional(t.Numeric()),
        cursor: t.Optional(t.String()),
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
    async ({ params, set }) => {
      const revision = await revisionService.getUnitRevision({
        unitId: params.unitId,
        sequence: Number(params.sequence),
      });
      if (!revision) {
        set.status = 404;
        return { message: "Revision not found" };
      }
      return { revision };
    },
    {
      params: singleRevisionParamsSchema,
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
    "/unit/:unitId/structure-events",
    async ({ params, query }) =>
      revisionService.listStructureEvents({
        unitId: params.unitId,
        limit: Number(query.limit ?? 50),
        cursor: query.cursor ?? null,
        eventType: query.eventType ?? null,
      }),
    {
      params: unitRevisionParamsSchema,
      query: t.Object({
        limit: t.Optional(t.Numeric()),
        cursor: t.Optional(t.String()),
        eventType: t.Optional(t.String()),
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
    async ({ params, set }) => {
      const event = await revisionService.getStructureEvent({
        unitId: params.unitId,
        sequence: Number(params.sequence),
        eventType: params.eventType,
      });
      if (!event) {
        set.status = 404;
        return { message: "Structure event not found" };
      }
      return { event };
    },
    {
      params: singleStructureEventParamsSchema,
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
