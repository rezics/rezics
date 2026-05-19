import {
  singleUnitRevisionResponseSchema,
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
  );
