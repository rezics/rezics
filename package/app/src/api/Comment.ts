import { queryOptions } from "@tanstack/react-query";
import { type ApiError, http } from "./react-query/http.ts";
import { type OffsetPaginated, type OffsetPaginationParams, type CommentDTO } from "contract";

// CommentDTO from contract

export type CommentTreeNode = CommentDTO & { children: CommentTreeNode[] };

const buildQuery = (params?: Record<string, unknown>) => {
  const q = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v == null) return;
    q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const commentKeys = {
  all: () => ["comment"] as const,
  byRoot: (rootPostId: string) => [...commentKeys.all(), "root", { rootPostId }] as const,
  byDepth: (
    rootPostId: string,
    depth: number,
    offset?: number,
    limit?: number,
  ) => [...commentKeys.all(), "depth", { rootPostId, depth, offset, limit }] as const,
  detail: (id: string) => [...commentKeys.all(), "detail", id] as const,
};

export const commentApi = {
  // 根据根对象 postId 拉取该根下的所有评论（扁平列表）
  listByRoot: (rootPostId: string) => http<CommentDTO[]>(`/comments${buildQuery({ rootPostId })}`),

  // 根据根对象 + 深度分页拉取（例如 depth=1 仅顶层评论）
  listByDepth: (
    rootPostId: string,
    depth: number,
    opts?: OffsetPaginationParams & { limit?: number },
  ) =>
    http<OffsetPaginated<CommentDTO>>(
      `/comments/by-depth${buildQuery({ rootPostId, depth, ...(opts ?? {}) })}`,
    ),

  // 单条评论详情
  get: (id: string) => http<CommentDTO>(`/comments/${id}`),
};

export const commentQueries = {
  byRoot: (rootPostId: string) =>
    queryOptions<CommentDTO[], ApiError, CommentDTO[], ReturnType<typeof commentKeys.byRoot>>({
      queryKey: commentKeys.byRoot(rootPostId),
      queryFn: () => commentApi.listByRoot(rootPostId),
    }),

  byDepth: (rootPostId: string, depth: number, offset?: number, limit?: number) =>
    queryOptions<
      OffsetPaginated<CommentDTO>,
      ApiError,
      OffsetPaginated<CommentDTO>,
      ReturnType<typeof commentKeys.byDepth>
    >({
      queryKey: commentKeys.byDepth(rootPostId, depth, offset, limit),
      queryFn: () => commentApi.listByDepth(rootPostId, depth, { offset, limit }),
    }),

  byId: (id: string) =>
    queryOptions<CommentDTO, ApiError, CommentDTO, ReturnType<typeof commentKeys.detail>>({
      queryKey: commentKeys.detail(id),
      queryFn: () => commentApi.get(id),
    }),
};

// 将扁平列表构造成树形结构（父子关系通过 id/parentCommentId 关联）
export function buildCommentTree(list: CommentDTO[]): CommentTreeNode[] {
  const nodeMap = new Map<string, CommentTreeNode>();
  const roots: CommentTreeNode[] = [];

  for (const item of list) {
    nodeMap.set(item.id, { ...item, children: [] });
  }

  for (const node of nodeMap.values()) {
    const parentId = node.parentCommentId ?? undefined;
    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // 可选：按创建时间或其他规则排序（这里不强制）
  return roots;
}
