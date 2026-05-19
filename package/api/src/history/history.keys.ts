export type HistoryTimelineParams = {
  cursor?: string | null;
  limit?: number;
};

export const historyKeys = {
  all: () => ["history"] as const,
  unit: (unitId: string) => [...historyKeys.all(), "unit", unitId] as const,
  revisions: (unitId: string, params?: HistoryTimelineParams) =>
    [...historyKeys.unit(unitId), "revisions", params ?? null] as const,
  revision: (unitId: string, sequence: number) =>
    [...historyKeys.unit(unitId), "revision", sequence] as const,
};
