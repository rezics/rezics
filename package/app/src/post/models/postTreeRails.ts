import type { PostDTO } from "@rezics/contract";

const SORT_PATH_SEPARATOR = ".";

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

export interface PostTreeNodeModel {
  post: PostDTO;
  displayDepth: number;
  atMaxDepth: boolean;
  children: PostTreeNodeModel[];
}

export function buildPostTreeNodes({
  posts,
  baseDepth,
  maxDepth,
  visualMaxDepth,
}: {
  posts: PostDTO[];
  baseDepth: number;
  maxDepth: number;
  visualMaxDepth: number;
}): PostTreeNodeModel[] {
  const nodesByPostUnitId = new Map<string, PostTreeNodeModel>();
  const roots: PostTreeNodeModel[] = [];

  posts.forEach((post, index) => {
    const displayDepth = getDisplayDepth(post, baseDepth, visualMaxDepth);
    const node = {
      post,
      displayDepth,
      atMaxDepth:
        Math.max(0, (post.depth ?? 0) - baseDepth) === maxDepth &&
        (post.directReplyCount ?? 0) > 0,
      children: [],
    };
    nodesByPostUnitId.set(post.unitId, node);

    const parent = findNearestVisibleAncestor(posts.slice(0, index), post);
    const parentNode = parent
      ? nodesByPostUnitId.get(parent.unitId)
      : undefined;
    if (parentNode) {
      parentNode.children.push(node);
      return;
    }
    roots.push(node);
  });

  return roots;
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
  const parentSegments = parent.sortPath.split(SORT_PATH_SEPARATOR);
  const postSegments = post.sortPath.split(SORT_PATH_SEPARATOR);
  const childSegment = postSegments[parentSegments.length];
  if (!childSegment) return undefined;
  return `${parent.sortPath}${SORT_PATH_SEPARATOR}${childSegment}`;
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
