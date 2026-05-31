/**
 * React Query keys for Post queries
 */

import type { PostFilters } from "./post.types";

export type PostByTargetFilters = Omit<PostFilters, "targetUnitId">;

export const postKeys = {
  /**
   * Base key for all post queries
   */
  all: () => ["posts"] as const,

  /**
   * Keys for list queries
   */
  lists: () => [...postKeys.all(), "list"] as const,
  list: (filters?: PostFilters) =>
    [...postKeys.lists(), filters ?? null] as const,

  /**
   * Keys for detail queries
   */
  details: () => [...postKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...postKeys.details(), unitId] as const,

  /**
   * Keys for target-specific queries (posts about a unit).
   * `byTargets` is the prefix covering every filter variant —
   * use it to invalidate all variants for a target.
   */
  byTargets: (targetUnitId: string) =>
    [...postKeys.all(), "target", targetUnitId] as const,
  byTarget: (targetUnitId: string, filters?: PostByTargetFilters) =>
    [...postKeys.byTargets(targetUnitId), filters ?? null] as const,
  wikiByTarget: (targetUnitId: string, filters?: PostByTargetFilters) =>
    [...postKeys.byTargets(targetUnitId), "wiki", filters ?? null] as const,

  /**
   * Keys for author-specific queries
   */
  byAuthors: (authorUserId: string) =>
    [...postKeys.all(), "author", authorUserId] as const,
  byAuthor: (authorUserId: string, filters?: PostFilters) =>
    [...postKeys.byAuthors(authorUserId), filters ?? null] as const,

  /**
   * Keys for thread queries (replies under a root post)
   */
  threads: (rootPostUnitId: string) =>
    [...postKeys.all(), "thread", rootPostUnitId] as const,
  thread: (rootPostUnitId: string, filters?: PostFilters) =>
    [...postKeys.threads(rootPostUnitId), filters ?? null] as const,
  /**
   * Keys for realm-scoped queries
   */
  byRealms: (realmUnitId: string) =>
    [...postKeys.all(), "realm", realmUnitId] as const,
  byRealm: (realmUnitId: string, filters?: PostFilters) =>
    [...postKeys.byRealms(realmUnitId), filters ?? null] as const,
  wikiByRealm: (
    realmUnitId: string,
    filters?: Omit<PostFilters, "kind" | "realmUnitId">,
  ) => [...postKeys.byRealms(realmUnitId), "wiki", filters ?? null] as const,
  moderationOverlays: (
    realmUnitId: string | null | undefined,
    targetUnitIds: string[],
  ) =>
    [
      ...postKeys.all(),
      "moderation-overlays",
      realmUnitId ?? null,
      [...targetUnitIds].sort(),
    ] as const,
} as const;
