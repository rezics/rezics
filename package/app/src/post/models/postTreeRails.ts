import type { PostDTO } from "@rezics/contract";

const PATH_SEPARATOR = ".";

/**
 * Whether `candidate` lies within the subtree rooted at `prefix` (i.e. is the
 * prefix itself or one of its descendants). The trailing-separator check keeps
 * the comparison label-boundary-safe: ltree labels are variable-length base36
 * tokens, so a raw `startsWith` would falsely match siblings (e.g. `1.30`
 * against prefix `1.3`).
 */
function isInBranch(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}${PATH_SEPARATOR}`);
}

export function isDescendantPost(parent: PostDTO, post: PostDTO): boolean {
  if (!parent.path || !post.path) return false;
  return post.path.startsWith(`${parent.path}${PATH_SEPARATOR}`);
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

/**
 * Render precedence within a sibling group: accepted answers first, then pins,
 * then ordinary replies. Lower rank renders earlier.
 */
function promotionRank(post: PostDTO): number {
  if (post.pinKind === "ACCEPTED_ANSWER") return 0;
  if (post.pinKind === "PINNED") return 1;
  return 2;
}

/**
 * Order a sibling group as `[ACCEPTED_ANSWER, then PINNED, each by pinPosition]`
 * followed by ordinary replies in their existing (DB-ordered) base order. The
 * overlay is composed on top of the base sort and never touches `path`.
 */
export function orderSiblingsByPromotion(
  nodes: PostTreeNodeModel[],
): PostTreeNodeModel[] {
  return nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => {
      const rankA = promotionRank(a.node.post);
      const rankB = promotionRank(b.node.post);
      if (rankA !== rankB) return rankA - rankB;
      if (rankA < 2) {
        const posA = a.node.post.pinPosition ?? "";
        const posB = b.node.post.pinPosition ?? "";
        if (posA !== posB) return posA < posB ? -1 : 1;
      }
      // Preserve the base sort for ties (and for ordinary replies).
      return a.index - b.index;
    })
    .map((entry) => entry.node);
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

  // Compose the promotion overlay on the DB-ordered base: order every sibling
  // group with accepted answers and pins ahead of ordinary replies.
  const applyPromotionOrder = (nodes: PostTreeNodeModel[]) => {
    for (const node of nodes) {
      if (node.children.length > 0) {
        node.children = orderSiblingsByPromotion(node.children);
        applyPromotionOrder(node.children);
      }
    }
  };
  const orderedRoots = orderSiblingsByPromotion(roots);
  applyPromotionOrder(orderedRoots);

  return orderedRoots;
}

export function findNearestVisibleAncestor(
  posts: PostDTO[],
  post: PostDTO,
): PostDTO | undefined {
  return posts
    .filter((candidate) => candidate.unitId !== post.unitId)
    .filter((candidate) => isDescendantPost(candidate, post))
    .sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0))[0];
}

export function getChildBranchPrefix(
  parent: PostDTO,
  post: PostDTO,
): string | undefined {
  if (!parent.path || !post.path || !isDescendantPost(parent, post)) {
    return undefined;
  }
  const parentSegments = parent.path.split(PATH_SEPARATOR);
  const postSegments = post.path.split(PATH_SEPARATOR);
  const childSegment = postSegments[parentSegments.length];
  if (!childSegment) return undefined;
  return `${parent.path}${PATH_SEPARATOR}${childSegment}`;
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
      !!candidate.path &&
      !isInBranch(candidate.path, branchPrefix),
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
    .sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0))
    .flatMap((ancestor) => {
      const level = getDisplayDepth(ancestor, baseDepth, visualMaxDepth);
      if (level === parentLineLevel || usedLevels.has(level)) return [];
      if (!hasLaterSiblingBranch(visibleAfter, ancestor, post)) return [];
      usedLevels.add(level);
      return [{ level, postUnitId: ancestor.unitId }];
    });
}
