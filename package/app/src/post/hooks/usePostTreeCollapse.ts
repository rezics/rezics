import type { PostDTO } from "@rezics/contract";
import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_VISIBLE_GENERATIONS = 3;

export interface PostTreeCollapseOptions {
  baseDepth?: number;
  defaultVisibleGenerations?: number;
  revealPostUnitId?: string;
}

type SeedCollapsedIdsOptions =
  | number
  | Pick<
      PostTreeCollapseOptions,
      "baseDepth" | "defaultVisibleGenerations" | "revealPostUnitId"
    >;

export function excludeRootPost(
  posts: PostDTO[],
  rootUnitId: string,
): PostDTO[] {
  return posts.filter((post) => post.unitId !== rootUnitId);
}

export function seedCollapsedIds(
  posts: PostDTO[],
  options?: SeedCollapsedIdsOptions,
): Set<string> {
  const normalizedOptions =
    typeof options === "number"
      ? { defaultVisibleGenerations: options }
      : (options ?? {});
  const baseDepth = normalizedOptions.baseDepth ?? 0;
  const defaultVisibleGenerations =
    normalizedOptions.defaultVisibleGenerations ?? DEFAULT_VISIBLE_GENERATIONS;
  const revealExpandedIds = getRevealExpandedIds(
    posts,
    normalizedOptions.revealPostUnitId,
  );

  const set = new Set<string>();
  for (const post of posts) {
    const relativeDepth = Math.max(0, (post.depth ?? 0) - baseDepth);
    if (
      relativeDepth >= defaultVisibleGenerations &&
      !revealExpandedIds.has(post.unitId)
    ) {
      set.add(post.unitId);
    }
  }
  return set;
}

export function getRevealExpandedIds(
  posts: PostDTO[],
  revealPostUnitId?: string,
): Set<string> {
  if (!revealPostUnitId) return new Set();

  const target = posts.find((post) => post.unitId === revealPostUnitId);
  if (!target?.path) {
    return new Set(revealPostUnitId ? [revealPostUnitId] : []);
  }

  const set = new Set<string>();
  for (const post of posts) {
    if (!post.path) continue;
    if (target.path === post.path || target.path.startsWith(`${post.path}.`)) {
      set.add(post.unitId);
    }
  }
  return set;
}

export function filterByPathPrefix(
  posts: PostDTO[],
  collapsedIds: Set<string>,
): PostDTO[] {
  if (collapsedIds.size === 0) return posts;

  const collapsedPaths: string[] = [];
  for (const post of posts) {
    if (collapsedIds.has(post.unitId) && post.path) {
      collapsedPaths.push(post.path);
    }
  }
  if (collapsedPaths.length === 0) return posts;
  collapsedPaths.sort((a, b) => a.length - b.length);

  return posts.filter((post) => {
    if (!post.path) return true;
    for (const prefix of collapsedPaths) {
      // The collapsed post itself stays visible; its descendants are hidden.
      // The trailing separator keeps the prefix test label-boundary-safe for
      // variable-length ltree labels.
      if (post.path === prefix) return true;
      if (post.path.startsWith(`${prefix}.`)) {
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
  options?: PostTreeCollapseOptions,
): UsePostTreeCollapseResult {
  const baseDepth = options?.baseDepth ?? 0;
  const defaultVisibleGenerations =
    options?.defaultVisibleGenerations ?? DEFAULT_VISIBLE_GENERATIONS;
  const revealPostUnitId = options?.revealPostUnitId;

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() =>
    seedCollapsedIds(posts, {
      baseDepth,
      defaultVisibleGenerations,
      revealPostUnitId,
    }),
  );

  const [seededUnitIds, setSeededUnitIds] = useState<Set<string>>(
    () => new Set(posts.map((post) => post.unitId)),
  );

  useEffect(() => {
    const nextSeeded = new Set(seededUnitIds);
    const newPosts = posts.filter((post) => !seededUnitIds.has(post.unitId));
    const revealExpandedIds = getRevealExpandedIds(posts, revealPostUnitId);

    if (newPosts.length === 0 && revealExpandedIds.size === 0) return;

    setCollapsedIds((prev) => {
      const next = new Set(prev);
      let changed = false;

      for (const postUnitId of revealExpandedIds) {
        if (next.delete(postUnitId)) changed = true;
      }

      for (const post of newPosts) {
        nextSeeded.add(post.unitId);
        const relativeDepth = Math.max(0, (post.depth ?? 0) - baseDepth);
        if (
          relativeDepth >= defaultVisibleGenerations &&
          !revealExpandedIds.has(post.unitId)
        ) {
          next.add(post.unitId);
          changed = true;
        }
      }

      return changed ? next : prev;
    });

    if (newPosts.length > 0) setSeededUnitIds(nextSeeded);
  }, [
    baseDepth,
    defaultVisibleGenerations,
    posts,
    revealPostUnitId,
    seededUnitIds,
  ]);

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
    () => filterByPathPrefix(posts, collapsedIds),
    [posts, collapsedIds],
  );

  return { collapsedIds, isCollapsed, toggleCollapse, visiblePosts };
}
