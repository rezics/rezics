import type {
  SingleStructureEventResponse,
  SingleUnitRevisionResponse,
  StructureEventTimelinePage,
  UnitRevisionTimelinePage,
} from "@rezics/contract";
import {
  singleStructureEventResponseSchema,
  singleUnitRevisionResponseSchema,
  structureEventTimelinePageSchema,
  unitRevisionTimelinePageSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { prisma } from "#/prisma/client";
import { env } from "@/env";
import { tryResolveIdentity } from "@/middleware";
import { AppError, forbidden, notFound } from "@/utils/errors";
import { canViewHistoryMetadata } from "./history-authority";

const unitHistoryParamsSchema = t.Object({
  unitId: t.String(),
});

const unitRevisionParamsSchema = t.Object({
  unitId: t.String(),
  sequence: t.Numeric(),
});

const structureEventParamsSchema = t.Object({
  unitId: t.String(),
  sequence: t.Numeric(),
  eventType: t.String(),
});

const timelineQuerySchema = t.Object({
  limit: t.Optional(t.Numeric()),
  cursor: t.Optional(t.String()),
  includeContent: t.Optional(t.Boolean()),
  includePayload: t.Optional(t.Boolean()),
  eventType: t.Optional(t.String()),
});

type HistoryQuery = {
  cursor?: string;
  eventType?: string;
  includeContent?: boolean;
  includePayload?: boolean;
  limit?: number;
};

function appendQuery(path: string, query: HistoryQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function historyServiceUrl(path: string): string {
  if (!env.HISTORY_BASE_URL) {
    throw new AppError(503, "History service is not configured", {
      code: "HISTORY_SERVICE_UNAVAILABLE",
    });
  }
  return `${env.HISTORY_BASE_URL.replace(/\/$/, "")}${path}`;
}

async function assertCanReadHistory(
  unitId: string,
  headers: Record<string, string | undefined>,
) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true,
      userId: true,
      visibility: true,
      status: true,
    },
  });
  if (!unit) throw notFound("Unit");

  const identity = await tryResolveIdentity(
    headers["authorization"],
    headers["cookie"],
  );
  if (!canViewHistoryMetadata(identity, unit)) {
    throw forbidden("you cannot view history for this Unit");
  }
}

async function fetchHistoryJson<T>(path: string): Promise<T> {
  const response = await fetch(historyServiceUrl(path), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new AppError(response.status, await response.text(), {
      code: "HISTORY_SERVICE_ERROR",
    });
  }
  return (await response.json()) as T;
}

const encodePathPart = (value: string | number) => encodeURIComponent(value);

export const historyProxyApi = new Elysia({ prefix: "/history" })
  .onError(({ error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return {
        status: error.statusCode,
        code: error.code ?? "HISTORY_PROXY_ERROR",
        message: error.message,
        ...(error.details ? { detail: error.details } : {}),
      };
    }
  })
  .get(
    "/unit/:unitId/revisions",
    async ({ headers, params, query }): Promise<UnitRevisionTimelinePage> => {
      await assertCanReadHistory(params.unitId, headers);
      return fetchHistoryJson<UnitRevisionTimelinePage>(
        appendQuery(
          `/history/unit/${encodePathPart(params.unitId)}/revisions`,
          {
            cursor: query.cursor,
            includeContent: query.includeContent,
            limit: query.limit,
          },
        ),
      );
    },
    {
      params: unitHistoryParamsSchema,
      query: timelineQuerySchema,
      response: unitRevisionTimelinePageSchema,
      detail: {
        summary: "List app-facing Unit revision timeline",
        tags: ["History"],
      },
    },
  )
  .get(
    "/unit/:unitId/revisions/:sequence",
    async ({ headers, params, query }): Promise<SingleUnitRevisionResponse> => {
      await assertCanReadHistory(params.unitId, headers);
      return fetchHistoryJson<SingleUnitRevisionResponse>(
        appendQuery(
          `/history/unit/${encodePathPart(params.unitId)}/revisions/${encodePathPart(params.sequence)}`,
          { includeContent: query.includeContent },
        ),
      );
    },
    {
      params: unitRevisionParamsSchema,
      query: timelineQuerySchema,
      response: singleUnitRevisionResponseSchema,
      detail: {
        summary: "Get app-facing Unit revision",
        tags: ["History"],
      },
    },
  )
  .get(
    "/unit/:unitId/structure-events",
    async ({ headers, params, query }): Promise<StructureEventTimelinePage> => {
      await assertCanReadHistory(params.unitId, headers);
      return fetchHistoryJson<StructureEventTimelinePage>(
        appendQuery(
          `/history/unit/${encodePathPart(params.unitId)}/structure-events`,
          {
            cursor: query.cursor,
            eventType: query.eventType,
            includePayload: query.includePayload,
            limit: query.limit,
          },
        ),
      );
    },
    {
      params: unitHistoryParamsSchema,
      query: timelineQuerySchema,
      response: structureEventTimelinePageSchema,
      detail: {
        summary: "List app-facing Unit structure events",
        tags: ["History"],
      },
    },
  )
  .get(
    "/unit/:unitId/structure-events/:sequence/:eventType",
    async ({
      headers,
      params,
      query,
    }): Promise<SingleStructureEventResponse> => {
      await assertCanReadHistory(params.unitId, headers);
      return fetchHistoryJson<SingleStructureEventResponse>(
        appendQuery(
          `/history/unit/${encodePathPart(params.unitId)}/structure-events/${encodePathPart(params.sequence)}/${encodePathPart(params.eventType)}`,
          { includePayload: query.includePayload },
        ),
      );
    },
    {
      params: structureEventParamsSchema,
      query: timelineQuerySchema,
      response: singleStructureEventResponseSchema,
      detail: {
        summary: "Get app-facing Unit structure event",
        tags: ["History"],
      },
    },
  );
