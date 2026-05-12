import type { PostDTO } from "@rezics/contract";
import { useCallback, useMemo, useState } from "react";

const DEFAULT_COLLAPSE_DEPTH = 2;

export function excludeRootPost(
  posts: PostDTO[],
  rootPostUnitId: string,
): PostDTO[] {
  return posts.filter((post) => post.unitId !== rootPostUnitId);
}

export function seedCollapsedIds(
  posts: PostDTO[],
  defaultCollapseDepth = DEFAULT_COLLAPSE_DEPTH,
): Set<string> {
  const set = new Set<string>();
  for (const post of posts) {
    if ((post.depth ?? 0) >= defaultCollapseDepth) set.add(post.unitId);
  }
  return set;
}

export function filterBySortPathPrefix(
  posts: PostDTO[],
  collapsedIds: Set<string>,
): PostDTO[] {
  if (collapsedIds.size === 0) return posts;

  const collapsedSortPaths: string[] = [];
  for (const post of posts) {
    if (collapsedIds.has(post.unitId) && post.sortPath) {
      collapsedSortPaths.push(post.sortPath);
    }
  }
  if (collapsedSortPaths.length === 0) return posts;
  collapsedSortPaths.sort((a, b) => a.length - b.length);

  return posts.filter((post) => {
    if (!post.sortPath) return true;
    for (const prefix of collapsedSortPaths) {
      if (post.sortPath === prefix) return true;
      if (
        post.sortPath.length > prefix.length &&
        post.sortPath.startsWith(prefix)
      ) {
        return false;
      }
    }
    return true;
  });
}

export interface UsePostTreeCollapseResult {
  collapsedIds: Set<string>;
  isCollapsed: (unitId: string) => boolean;
  toggleCollapse: (unitId: string) => void;
  visiblePosts: PostDTO[];
}

export function usePostTreeCollapse(
  posts: PostDTO[],
  options?: { defaultCollapseDepth?: number },
): UsePostTreeCollapseResult {
  const defaultDepth = options?.defaultCollapseDepth ?? DEFAULT_COLLAPSE_DEPTH;

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() =>
    seedCollapsedIds(posts, defaultDepth),
  );

  const [seededUnitIds, setSeededUnitIds] = useState<Set<string>>(
    () => new Set(posts.map((post) => post.unitId)),
  );

  if (posts.some((post) => !seededUnitIds.has(post.unitId))) {
    const nextSeeded = new Set(seededUnitIds);
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      for (const post of posts) {
        if (!seededUnitIds.has(post.unitId)) {
          nextSeeded.add(post.unitId);
          if ((post.depth ?? 0) >= defaultDepth) next.add(post.unitId);
        }
      }
      return next;
    });
    setSeededUnitIds(nextSeeded);
  }

  const isCollapsed = useCallback(
    (unitId: string) => collapsedIds.has(unitId),
    [collapsedIds],
  );

  const toggleCollapse = useCallback((unitId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }, []);

  const visiblePosts = useMemo(
    () => filterBySortPathPrefix(posts, collapsedIds),
    [posts, collapsedIds],
  );

  return { collapsedIds, isCollapsed, toggleCollapse, visiblePosts };
}
