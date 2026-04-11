import type { PostDTO } from "@rezics/contract";
import type { UiComment } from "./TreeReplyComponents";

/**
 * Build a tree from flat PostDTO[] (comments with parentPostUnitId).
 * Replaces the old CommentTreeNode-based buildTree.
 */
export function buildTree(items: PostDTO[] | undefined): UiComment[] {
  if (!items || items.length === 0) return [];

  // Map of unitId -> UiComment
  const map = new Map<string, UiComment>();
  // Group by parentPostUnitId
  const childrenMap = new Map<string | null | undefined, UiComment[]>();

  for (const n of items) {
    const ui: UiComment = {
      id: n.unitId,
      content: n.body ?? null,
      created_at: n.createdAt
        ? typeof n.createdAt === "string"
          ? n.createdAt
          : new Date(n.createdAt as any).toISOString()
        : undefined,
      user: n.author
        ? { unitId: n.author.unitId, name: n.author.name, avatar: n.author.avatar }
        : undefined,
      replies: [],
    };
    map.set(n.unitId, ui);
    const key = n.parentPostUnitId ?? null;
    const list = childrenMap.get(key) ?? [];
    list.push(ui);
    childrenMap.set(key, list);
  }

  // Link children to parents
  for (const n of items) {
    const parentId = n.parentPostUnitId ?? null;
    if (parentId && map.has(parentId)) {
      const parent = map.get(parentId)!;
      const childList = childrenMap.get(parentId) ?? [];
      parent.replies = childList;
    }
  }

  // Roots are those with no parent or missing parent in this slice
  const roots: UiComment[] = [];
  const rootCandidates =
    childrenMap.get(null) ?? childrenMap.get(undefined) ?? [];
  for (const r of rootCandidates) {
    roots.push(r);
  }

  // Some nodes may reference a parent not included in the slice; treat them as roots
  if (roots.length === 0) {
    for (const n of items) {
      const parentId = n.parentPostUnitId ?? null;
      if (!parentId || !map.has(parentId)) {
        const ui = map.get(n.unitId)!;
        if (!roots.includes(ui)) roots.push(ui);
      }
    }
  }

  return roots;
}
