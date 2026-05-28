import type {
  ListWorkRealmContextQuery,
  ResolveWorkRealmContextQuery,
} from "@rezics/contract";

export const workRealmContextKeys = {
  all: () => ["work-realm-context"] as const,
  lists: () => [...workRealmContextKeys.all(), "list"] as const,
  list: (query?: ListWorkRealmContextQuery) =>
    [...workRealmContextKeys.lists(), query] as const,
  details: () => [...workRealmContextKeys.all(), "detail"] as const,
  detail: (contextId: string) =>
    [...workRealmContextKeys.details(), contextId] as const,
  resolves: () => [...workRealmContextKeys.all(), "resolve"] as const,
  resolve: (query: ResolveWorkRealmContextQuery) =>
    [...workRealmContextKeys.resolves(), query] as const,
  byRelease: (
    releaseUnitId: string,
    query?: Omit<ResolveWorkRealmContextQuery, "releaseUnitId">,
  ) =>
    [
      ...workRealmContextKeys.resolves(),
      "release",
      releaseUnitId,
      query,
    ] as const,
} as const;
