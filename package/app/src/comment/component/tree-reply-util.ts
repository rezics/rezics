import type {UiComment} from './TreeReplyComponents';
import type {CommentTreeNode} from '@rezics/contract';

export function buildTree(items: CommentTreeNode[] | undefined): UiComment[] {
  if (!items || items.length === 0) return [];

  // Map of id -> UiComment
  const map = new Map<string, UiComment>();
  // Group by parentId
  const childrenMap = new Map<string | null | undefined, UiComment[]>();

  for (const n of items) {
    const ui: UiComment = {
      id: n.id,
      content: n.content ?? null,
      created_at: n.createdAt
        ? typeof n.createdAt === 'string'
          ? n.createdAt
          : new Date(n.createdAt as any).toISOString()
        : undefined,
      user: n.user ? n.user : undefined,
      replies: [],
    };
    map.set(n.id, ui);
    const key = (n as any).parentCommentId ?? null;
    const list = childrenMap.get(key) ?? [];
    list.push(ui);
    childrenMap.set(key, list);
  }

  // Link children to parents
  for (const n of items) {
    const parentId = (n as any).parentCommentId ?? null;
    if (parentId && map.has(parentId)) {
      const parent = map.get(parentId)!;
      const childList = childrenMap.get(parentId) ?? [];
      // Ensure parent's replies uses grouped list
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
    // Fallback: choose items with missing parent
    for (const n of items) {
      const parentId = (n as any).parentCommentId ?? null;
      if (!parentId || !map.has(parentId)) {
        const ui = map.get(n.id)!;
        if (!roots.includes(ui)) roots.push(ui);
      }
    }
  }

  return roots;
}
