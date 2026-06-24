export type HistoryTimelineParams = {
  cursor?: string | null;
  limit?: number;
  includeContent?: boolean;
  includePayload?: boolean;
  eventType?: string | null;
};

export const historyKeys = {
  all: () => ["history"] as const,
  unit: (unitId: string) => [...historyKeys.all(), "unit", unitId] as const,
  revisions: (unitId: string, params?: HistoryTimelineParams) =>
    [...historyKeys.unit(unitId), "revisions", params ?? null] as const,
  revision: (
    unitId: string,
    sequence: number,
    params?: Pick<HistoryTimelineParams, "includeContent">,
  ) =>
    [
      ...historyKeys.unit(unitId),
      "revision",
      sequence,
      params ?? null,
    ] as const,
  structureEvents: (unitId: string, params?: HistoryTimelineParams) =>
    [...historyKeys.unit(unitId), "structure-events", params ?? null] as const,
  structureEvent: (
    unitId: string,
    sequence: number,
    eventType: string,
    params?: Pick<HistoryTimelineParams, "includePayload">,
  ) =>
    [
      ...historyKeys.unit(unitId),
      "structure-event",
      sequence,
      eventType,
      params ?? null,
    ] as const,
  actorResolution: (actorUserIds: readonly string[]) =>
    [
      ...historyKeys.all(),
      "resolve",
      "actors",
      [...actorUserIds].sort(),
    ] as const,
  unitResolution: (unitIds: readonly string[]) =>
    [...historyKeys.all(), "resolve", "units", [...unitIds].sort()] as const,
  compare: (unitId: string, baseSequence: number, targetSequence: number) =>
    [
      ...historyKeys.unit(unitId),
      "compare",
      baseSequence,
      targetSequence,
    ] as const,
};
