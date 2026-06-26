import type {
  SingleStructureEventResponse,
  SingleUnitRevisionResponse,
  StructureEventTimelinePage,
  UnitRevisionPathCompareResponse,
  UnitRevisionTimelinePage,
} from "@rezics/contract";
import {
  singleStructureEventResponseSchema,
  singleUnitRevisionResponseSchema,
  structureEventTimelinePageSchema,
  unitRevisionPathCompareResponseSchema,
  unitRevisionTimelinePageSchema,
} from "@rezics/contract";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import {
  revisionService,
  type RevisionService,
} from "../../history/revision/revision.service";
import { Unit } from "../db/schema";
import { env } from "../env";
import { tryResolveIdentity } from "../middleware";
import { AppError, forbidden, notFound } from "../utils/errors";
import {
  canViewHistoryMetadata,
  canViewRawHistoryPayload,
} from "./history-authority";

const unitHistoryParamsSchema = t.Object({
  unitId: t.String(),
});

const unitRevisionParamsSchema = t.Object({
  unitId: t.String(),
  sequence: t.Numeric(),
});

const revisionCompareParamsSchema = t.Object({
  unitId: t.String(),
  baseSequence: t.Numeric(),
  targetSequence: t.Numeric(),
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

type HistoryProxyUnit = Pick<
  typeof Unit.$inferSelect,
  "id" | "userId" | "visibility" | "status"
>;

export type HistoryProxyRepository = {
  findUnit(unitId: string): Promise<HistoryProxyUnit | undefined>;
};

export type HistoryProxyReader = Pick<RevisionService, "listUnitRevisions">;

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleHistoryProxyRepository(): HistoryProxyRepository {
  return {
    async findUnit(unitId) {
      const db = await getServerDb();
      const [unit] = await db
        .select({
          id: Unit.id,
          userId: Unit.userId,
          visibility: Unit.visibility,
          status: Unit.status,
        })
        .from(Unit)
        .where(eq(Unit.id, unitId))
        .limit(1);
      return unit;
    },
  };
}

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
  repository: HistoryProxyRepository,
  unitId: string,
  headers: Record<string, string | undefined>,
) {
  const unit = await repository.findUnit(unitId);
  if (!unit) throw notFound("Unit");

  const identity = await tryResolveIdentity(
    headers["authorization"],
    headers["cookie"],
  );
  if (!canViewHistoryMetadata(identity, unit)) {
    throw forbidden("you cannot view history for this Unit");
  }
  return { identity, unit };
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

export function createHistoryProxyApi(
  repository: HistoryProxyRepository = createDrizzleHistoryProxyRepository(),
  historyReader: HistoryProxyReader = revisionService,
) {
  return new Elysia({ prefix: "/history" })
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
      return undefined;
    })
    .get(
      "/unit/:unitId/revisions",
      async ({ headers, params, query }): Promise<UnitRevisionTimelinePage> => {
        const context = await assertCanReadHistory(
          repository,
          params.unitId,
          headers,
        );
        if (
          query.includeContent &&
          !canViewRawHistoryPayload(context.identity, context.unit)
        ) {
          throw forbidden("you cannot view raw history payloads for this Unit");
        }
        return historyReader.listUnitRevisions({
          unitId: params.unitId,
          cursor: query.cursor ?? null,
          includeContent: query.includeContent ?? false,
          limit: query.limit,
        });
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
      "/unit/:unitId/revisions/compare/:baseSequence/:targetSequence",
      async ({ headers, params }): Promise<UnitRevisionPathCompareResponse> => {
        await assertCanReadHistory(repository, params.unitId, headers);
        return fetchHistoryJson<UnitRevisionPathCompareResponse>(
          `/history/unit/${encodePathPart(params.unitId)}/revisions/compare/${encodePathPart(params.baseSequence)}/${encodePathPart(params.targetSequence)}`,
        );
      },
      {
        params: revisionCompareParamsSchema,
        response: unitRevisionPathCompareResponseSchema,
        detail: {
          summary: "Compare app-facing Unit revisions",
          tags: ["History"],
        },
      },
    )
    .get(
      "/unit/:unitId/revisions/:sequence",
      async ({
        headers,
        params,
        query,
      }): Promise<SingleUnitRevisionResponse> => {
        const context = await assertCanReadHistory(
          repository,
          params.unitId,
          headers,
        );
        const includeContent = query.includeContent ?? false;
        if (
          includeContent &&
          !canViewRawHistoryPayload(context.identity, context.unit)
        ) {
          throw forbidden("you cannot view raw history payloads for this Unit");
        }
        return fetchHistoryJson<SingleUnitRevisionResponse>(
          appendQuery(
            `/history/unit/${encodePathPart(params.unitId)}/revisions/${encodePathPart(params.sequence)}`,
            { includeContent },
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
      async ({
        headers,
        params,
        query,
      }): Promise<StructureEventTimelinePage> => {
        const context = await assertCanReadHistory(
          repository,
          params.unitId,
          headers,
        );
        if (
          query.includePayload &&
          !canViewRawHistoryPayload(context.identity, context.unit)
        ) {
          throw forbidden("you cannot view raw history payloads for this Unit");
        }
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
        const context = await assertCanReadHistory(
          repository,
          params.unitId,
          headers,
        );
        const includePayload = query.includePayload ?? false;
        if (
          includePayload &&
          !canViewRawHistoryPayload(context.identity, context.unit)
        ) {
          throw forbidden("you cannot view raw history payloads for this Unit");
        }
        return fetchHistoryJson<SingleStructureEventResponse>(
          appendQuery(
            `/history/unit/${encodePathPart(params.unitId)}/structure-events/${encodePathPart(params.sequence)}/${encodePathPart(params.eventType)}`,
            { includePayload },
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
}

export const historyProxyApi = createHistoryProxyApi();
