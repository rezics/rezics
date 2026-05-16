// MOCK: Works tab data source — entity→attribution→work lookup is not yet
// exposed by the server. Returns an empty result so the Works tab is hidden
// (per entity-detail-page spec: empty tabs SHALL NOT render). When the
// `/attribution/by-entity/:entityId` endpoint lands, swap this for a real
// useQuery against it.
export function useEntityWorks(_entityUnitId: string): {
  works: Array<{ unitId: string; type: string; title: string }>;
  isLoading: boolean;
} {
  return { works: [], isLoading: false };
}
