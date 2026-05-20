import type {
  HistoryActorResolutionBatchResponse,
  HistoryUnitReferenceResolutionBatchResponse,
  SingleUnitRevisionResponse,
  SingleStructureEventResponse,
  StructureEventTimelinePage,
  UnitRevisionTimelinePage,
} from "@rezics/contract";
import { getApiConfig } from "../config";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { HistoryTimelineParams } from "./history.keys";

function historyEndpoint(path: string) {
  const historyBaseUrl = getApiConfig().historyBaseUrl;
  if (!historyBaseUrl) return path;
  return `${historyBaseUrl}${path}`;
}

const encodePathPart = (value: string | number) => encodeURIComponent(value);

export const historyApi = {
  listUnitRevisions(
    unitId: string,
    params?: HistoryTimelineParams,
  ): Promise<UnitRevisionTimelinePage> {
    return apiFetch<UnitRevisionTimelinePage>(
      historyEndpoint(
        `/unit/${encodePathPart(unitId)}/revisions${buildQueryString(params)}`,
      ),
    );
  },

  getUnitRevision(
    unitId: string,
    sequence: number,
    params?: Pick<HistoryTimelineParams, "includeContent">,
  ): Promise<SingleUnitRevisionResponse> {
    return apiFetch<SingleUnitRevisionResponse>(
      historyEndpoint(
        `/unit/${encodePathPart(unitId)}/revisions/${encodePathPart(sequence)}${buildQueryString(params)}`,
      ),
    );
  },

  listStructureEvents(
    unitId: string,
    params?: HistoryTimelineParams,
  ): Promise<StructureEventTimelinePage> {
    return apiFetch<StructureEventTimelinePage>(
      historyEndpoint(
        `/unit/${encodePathPart(unitId)}/structure-events${buildQueryString(params)}`,
      ),
    );
  },

  getStructureEvent(
    unitId: string,
    sequence: number,
    eventType: string,
    params?: Pick<HistoryTimelineParams, "includePayload">,
  ): Promise<SingleStructureEventResponse> {
    return apiFetch<SingleStructureEventResponse>(
      historyEndpoint(
        `/unit/${encodePathPart(unitId)}/structure-events/${encodePathPart(sequence)}/${encodePathPart(eventType)}${buildQueryString(params)}`,
      ),
    );
  },

  resolveActors(
    actorUserIds: readonly string[],
  ): Promise<HistoryActorResolutionBatchResponse> {
    return apiFetch<HistoryActorResolutionBatchResponse>(
      "/history/resolve/actors",
      {
        method: "POST",
        body: JSON.stringify({ ids: actorUserIds }),
      },
    );
  },

  resolveUnitReferences(
    unitIds: readonly string[],
  ): Promise<HistoryUnitReferenceResolutionBatchResponse> {
    return apiFetch<HistoryUnitReferenceResolutionBatchResponse>(
      "/history/resolve/units",
      {
        method: "POST",
        body: JSON.stringify({ ids: unitIds }),
      },
    );
  },

  async getRevisionCompareInput(
    unitId: string,
    baseSequence: number,
    targetSequence: number,
  ) {
    const [base, target] = await Promise.all([
      historyApi.getUnitRevision(unitId, baseSequence, {
        includeContent: true,
      }),
      historyApi.getUnitRevision(unitId, targetSequence, {
        includeContent: true,
      }),
    ]);
    return { unitId, base: base.revision, target: target.revision };
  },
};
