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

export const unitRevisionQuery = (
  unitId: string,
  sequence: number,
  params?: Pick<HistoryTimelineParams, "includeContent">,
) =>
  queryOptions({
    queryKey: historyKeys.revision(unitId, sequence, params),
    queryFn: () => historyApi.getUnitRevision(unitId, sequence, params),
    enabled: !!unitId && Number.isFinite(sequence),
    staleTime: 1000 * 60 * 5,
  });

export const structureEventTimelineQuery = (
  unitId: string,
  params?: HistoryTimelineParams,
) =>
  queryOptions({
    queryKey: historyKeys.structureEvents(unitId, params),
    queryFn: () => historyApi.listStructureEvents(unitId, params),
    enabled: !!unitId,
    staleTime: 1000 * 30,
    placeholderData: { events: [], nextCursor: null },
  });

export const structureEventQuery = (
  unitId: string,
  sequence: number,
  eventType: string,
  params?: Pick<HistoryTimelineParams, "includePayload">,
) =>
  queryOptions({
    queryKey: historyKeys.structureEvent(unitId, sequence, eventType, params),
    queryFn: () =>
      historyApi.getStructureEvent(unitId, sequence, eventType, params),
    enabled: !!unitId && Number.isFinite(sequence) && !!eventType,
    staleTime: 1000 * 60 * 5,
  });

export const historyActorResolutionQuery = (actorUserIds: readonly string[]) =>
  queryOptions({
    queryKey: historyKeys.actorResolution(actorUserIds),
    queryFn: () => historyApi.resolveActors(actorUserIds),
    enabled: actorUserIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });

export const historyUnitReferenceResolutionQuery = (
  unitIds: readonly string[],
) =>
  queryOptions({
    queryKey: historyKeys.unitResolution(unitIds),
    queryFn: () => historyApi.resolveUnitReferences(unitIds),
    enabled: unitIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });

export const revisionCompareInputQuery = (
  unitId: string,
  baseSequence: number,
  targetSequence: number,
) =>
  queryOptions({
    queryKey: historyKeys.compare(unitId, baseSequence, targetSequence),
    queryFn: () =>
      historyApi.getRevisionCompareInput(unitId, baseSequence, targetSequence),
    enabled:
      !!unitId &&
      Number.isFinite(baseSequence) &&
      Number.isFinite(targetSequence),
    staleTime: 1000 * 60 * 5,
  });

export const historyQueries = {
  unitRevisionTimeline: unitRevisionTimelineQuery,
  unitRevision: unitRevisionQuery,
  structureEventTimeline: structureEventTimelineQuery,
  structureEvent: structureEventQuery,
  actorResolution: historyActorResolutionQuery,
  unitReferenceResolution: historyUnitReferenceResolutionQuery,
  revisionCompareInput: revisionCompareInputQuery,
};
