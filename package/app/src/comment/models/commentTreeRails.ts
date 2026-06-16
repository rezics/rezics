import type { CommentDTO } from "@rezics/contract";

export interface CommentTreeNodeModel {
  post: CommentDTO;
  displayDepth: number;
  atMaxDepth: boolean;
  children: CommentTreeNodeModel[];
}

export function getDisplayDepth(
  post: CommentDTO,
  baseDepth: number,
  visualMaxDepth: number,
): number {
  return Math.min(Math.max(0, (post.depth ?? 0) - baseDepth), visualMaxDepth);
}

function promotionRank(post: CommentDTO): number {
  if (post.pinKind === "ACCEPTED_ANSWER") return 0;
  if (post.pinKind === "PINNED") return 1;
  return 2;
}

export function orderSiblingsByPromotion(
  nodes: CommentTreeNodeModel[],
): CommentTreeNodeModel[] {
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
      return a.index - b.index;
    })
    .map((entry) => entry.node);
}

export function buildCommentTreeNodes({
  posts,
  baseDepth,
  maxDepth,
  visualMaxDepth,
}: {
  posts: CommentDTO[];
  baseDepth: number;
  maxDepth: number;
  visualMaxDepth: number;
}): CommentTreeNodeModel[] {
  const nodesByPostUnitId = new Map<string, CommentTreeNodeModel>();
  const roots: CommentTreeNodeModel[] = [];

  for (const post of posts) {
    const displayDepth = getDisplayDepth(post, baseDepth, visualMaxDepth);
    const node: CommentTreeNodeModel = {
      post,
      displayDepth,
      atMaxDepth:
        Math.max(0, (post.depth ?? 0) - baseDepth) >= maxDepth &&
        (post.directReplyCount ?? 0) > 0,
      children: [],
    };
    nodesByPostUnitId.set(post.unitId, node);

    const parentNode = post.parentCommentId
      ? nodesByPostUnitId.get(post.parentCommentId)
      : undefined;
    if (parentNode) {
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const applyPromotionOrder = (nodes: CommentTreeNodeModel[]) => {
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

export function mergeCommentDiscoveryRows(
  pages: Array<{
    comments: CommentDTO[];
    parentContexts?: CommentDTO[];
  }>,
): CommentDTO[] {
  const merged: CommentDTO[] = [];
  const seen = new Set<string>();

  const add = (post: CommentDTO) => {
    if (seen.has(post.unitId)) return;
    seen.add(post.unitId);
    merged.push(post);
  };

  for (const page of pages) {
    for (const parent of page.parentContexts ?? []) add(parent);
    for (const post of page.comments) add(post);
  }

  return merged;
}

export function mergeCommentChildSliceRows(
  pages: Array<{ comments: CommentDTO[] }>,
): CommentDTO[] {
  const merged: CommentDTO[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    for (const post of page.comments) {
      if (seen.has(post.unitId)) continue;
      seen.add(post.unitId);
      merged.push(post);
    }
  }

  return merged;
}

function ancestorChainIds(
  posts: CommentDTO[],
  postUnitId: string,
): Set<string> {
  const byId = new Map(posts.map((post) => [post.unitId, post]));
  const set = new Set<string>();
  let current = byId.get(postUnitId);
  while (current) {
    set.add(current.unitId);
    current = current.parentCommentId
      ? byId.get(current.parentCommentId)
      : undefined;
  }
  return set;
}

export function getRevealExpandedIds(
  posts: CommentDTO[],
  revealPostUnitId?: string,
): Set<string> {
  if (!revealPostUnitId) return new Set();
  return ancestorChainIds(posts, revealPostUnitId);
}

export function filterByCollapsedParents(
  posts: CommentDTO[],
  collapsedIds: Set<string>,
): CommentDTO[] {
  if (collapsedIds.size === 0) return posts;

  const byId = new Map(posts.map((post) => [post.unitId, post]));
  return posts.filter((post) => {
    let parentId = post.parentCommentId ?? null;
    while (parentId) {
      if (collapsedIds.has(parentId)) return false;
      parentId = byId.get(parentId)?.parentCommentId ?? null;
    }
    return true;
  });
}

export function hasLaterSiblingBranch(
  posts: CommentDTO[],
  parent: CommentDTO,
  post: CommentDTO,
): boolean {
  return posts.some(
    (candidate) =>
      candidate.parentCommentId === parent.unitId &&
      candidate.unitId !== post.unitId,
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
  visibleBefore: CommentDTO[];
  visibleAfter: CommentDTO[];
  post: CommentDTO;
  baseDepth: number;
  visualMaxDepth: number;
  parentLineLevel?: number;
}): Array<{ level: number; postUnitId: string }> {
  const beforeById = new Map(
    visibleBefore.map((candidate) => [candidate.unitId, candidate]),
  );
  const lines: Array<{ level: number; postUnitId: string }> = [];
  let parent = post.parentCommentId
    ? beforeById.get(post.parentCommentId)
    : undefined;

  while (parent) {
    const level = getDisplayDepth(parent, baseDepth, visualMaxDepth);
    if (
      level !== parentLineLevel &&
      hasLaterSiblingBranch(visibleAfter, parent, post)
    ) {
      lines.push({ level, postUnitId: parent.unitId });
    }
    parent = parent.parentCommentId
      ? beforeById.get(parent.parentCommentId)
      : undefined;
  }

  return lines.reverse();
}
