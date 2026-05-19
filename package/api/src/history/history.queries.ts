import { queryOptions } from "@tanstack/react-query";
import { historyApi } from "./history.api";
import { type HistoryTimelineParams, historyKeys } from "./history.keys";

export const unitRevisionTimelineQuery = (
  unitId: string,
  params?: HistoryTimelineParams,
) =>
  queryOptions({
    queryKey: historyKeys.revisions(unitId, params),
    queryFn: () => historyApi.listUnitRevisions(unitId, params),
    enabled: !!unitId,
    staleTime: 1000 * 30,
    placeholderData: { revisions: [], nextCursor: null },
  });

export const unitRevisionQuery = (unitId: string, sequence: number) =>
  queryOptions({
    queryKey: historyKeys.revision(unitId, sequence),
    queryFn: () => historyApi.getUnitRevision(unitId, sequence),
    enabled: !!unitId && Number.isFinite(sequence),
    staleTime: 1000 * 60 * 5,
  });

export const historyQueries = {
  unitRevisionTimeline: unitRevisionTimelineQuery,
  unitRevision: unitRevisionQuery,
};
