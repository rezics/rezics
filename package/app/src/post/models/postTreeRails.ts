import type { PostDTO } from "@rezics/contract";

const SORT_PATH_SEPARATOR_RE = /[./]/;

export function isDescendantPost(parent: PostDTO, post: PostDTO): boolean {
  if (!parent.sortPath || !post.sortPath) return false;
  return (
    post.sortPath.length > parent.sortPath.length &&
    post.sortPath.startsWith(parent.sortPath)
  );
}

export function getDisplayDepth(
  post: PostDTO,
  baseDepth: number,
  visualMaxDepth: number,
): number {
  return Math.min(Math.max(0, (post.depth ?? 0) - baseDepth), visualMaxDepth);
}

export function findNearestVisibleAncestor(
  posts: PostDTO[],
  post: PostDTO,
): PostDTO | undefined {
  return posts
    .filter((candidate) => candidate.unitId !== post.unitId)
    .filter((candidate) => isDescendantPost(candidate, post))
    .sort((a, b) => (b.sortPath?.length ?? 0) - (a.sortPath?.length ?? 0))[0];
}

export function getChildBranchPrefix(
  parent: PostDTO,
  post: PostDTO,
): string | undefined {
  if (!parent.sortPath || !post.sortPath || !isDescendantPost(parent, post)) {
    return undefined;
  }
  const parentSegments = parent.sortPath.split(SORT_PATH_SEPARATOR_RE);
  const postSegments = post.sortPath.split(SORT_PATH_SEPARATOR_RE);
  const childSegment = postSegments[parentSegments.length];
  if (!childSegment) return undefined;
  const separator = post.sortPath[parent.sortPath.length] ?? ".";
  return `${parent.sortPath}${separator}${childSegment}`;
}

export function hasLaterSiblingBranch(
  posts: PostDTO[],
  parent: PostDTO,
  post: PostDTO,
): boolean {
  const branchPrefix = getChildBranchPrefix(parent, post);
  if (!branchPrefix) return false;
  return posts.some(
    (candidate) =>
      isDescendantPost(parent, candidate) &&
      !candidate.sortPath?.startsWith(branchPrefix),
  );
}

export function getContinuationLines({
  visibleBefore,
  visibleAfter,
  post,
  baseDepth,
  visualMaxDepth,
  parentLineLevel,
}: {
  visibleBefore: PostDTO[];
  visibleAfter: PostDTO[];
  post: PostDTO;
  baseDepth: number;
  visualMaxDepth: number;
  parentLineLevel?: number;
}): Array<{ level: number; postUnitId: string }> {
  const usedLevels = new Set<number>();
  return visibleBefore
    .filter((candidate) => isDescendantPost(candidate, post))
    .sort((a, b) => (a.sortPath?.length ?? 0) - (b.sortPath?.length ?? 0))
    .flatMap((ancestor) => {
      const level = getDisplayDepth(ancestor, baseDepth, visualMaxDepth);
      if (level === parentLineLevel || usedLevels.has(level)) return [];
      if (!hasLaterSiblingBranch(visibleAfter, ancestor, post)) return [];
      usedLevels.add(level);
      return [{ level, postUnitId: ancestor.unitId }];
    });
}
