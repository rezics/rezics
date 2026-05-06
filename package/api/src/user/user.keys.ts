/**
 * React Query keys for User queries
 */

export const userKeys = {
  all: () => ["users"] as const,
  lists: () => [...userKeys.all(), "list"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...userKeys.lists(), filters] as const,
  adminLists: () => [...userKeys.all(), "admin", "list"] as const,
  adminList: (filters?: Record<string, unknown>) =>
    [...userKeys.adminLists(), filters] as const,
  details: () => [...userKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...userKeys.details(), unitId] as const,
  bySlug: (userSlug: string) =>
    [...userKeys.all(), "by-slug", userSlug] as const,
  adminDetails: () => [...userKeys.all(), "admin", "detail"] as const,
  adminDetail: (unitId: string) =>
    [...userKeys.adminDetails(), unitId] as const,
  meDetail: () => [...userKeys.all(), "me", "detail"] as const,
  searches: () => [...userKeys.all(), "search"] as const,
  search: (q: string, filters?: Record<string, unknown>) =>
    [...userKeys.searches(), { q, ...filters }] as const,
  followers: (unitId: string, query?: Record<string, unknown>) =>
    [...userKeys.detail(unitId), "followers", query] as const,
  followings: (unitId: string, query?: Record<string, unknown>) =>
    [...userKeys.detail(unitId), "followings", query] as const,
  followStatus: (targetIds: string[]) =>
    [...userKeys.detail("me"), "follow-status", targetIds] as const,
  batch: (ids: string[]) => [...userKeys.all(), "batch", ids] as const,
  settings: () => [...userKeys.all(), "me", "settings"] as const,
} as const;
