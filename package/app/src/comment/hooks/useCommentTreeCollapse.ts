import type { CommentDTO } from "@rezics/contract";
import { useEffect, useMemo, useState } from "react";
import {
  filterByCollapsedParents,
  getRevealExpandedIds,
} from "../models/commentTreeRails";

export { filterByCollapsedParents, getRevealExpandedIds };

const DEFAULT_VISIBLE_GENERATIONS = 3;

export interface CommentTreeCollapseOptions {
  baseDepth?: number;
  defaultVisibleGenerations?: number;
  revealPostUnitId?: string;
}

type SeedCollapsedIdsOptions =
  | number
  | Pick<
      CommentTreeCollapseOptions,
      "baseDepth" | "defaultVisibleGenerations" | "revealPostUnitId"
    >;

export function seedCollapsedIds(
  posts: CommentDTO[],
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

export interface UseCommentTreeCollapseResult {
  collapsedIds: Set<string>;
  isCollapsed: (unitId: string) => boolean;
  toggleCollapse: (unitId: string) => void;
  visiblePosts: CommentDTO[];
}

export function useCommentTreeCollapse(
  posts: CommentDTO[],
  options?: CommentTreeCollapseOptions,
): UseCommentTreeCollapseResult {
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

  const isCollapsed = (unitId: string) => collapsedIds.has(unitId);

  const toggleCollapse = (unitId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const visiblePosts = useMemo(
    () => filterByCollapsedParents(posts, collapsedIds),
    [posts, collapsedIds],
  );

  return { collapsedIds, isCollapsed, toggleCollapse, visiblePosts };
}
