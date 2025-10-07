import { queryOptions } from "@tanstack/react-query";
import { http } from "./react-query/http.ts";
import { 
  type OffsetPaginated, 
  type OffsetPaginationParams, 
  type CommentDTO,
  type CreateCommentInput,
  type UpdateCommentInput
} from "contract";

// === Query Keys ===
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

// === Helper ===
const buildQuery = (params?: Record<string, unknown>) => {
  const q = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v == null) return;
    q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

// === API ===
export const commentApi = {
  listByRoot: (rootPostId: string) => 
    http<CommentDTO[]>(`/comments${buildQuery({ rootPostId })}`),

  listByDepth: (
    rootPostId: string,
    depth: number,
    opts?: OffsetPaginationParams & { limit?: number },
  ) =>
    http<OffsetPaginated<CommentDTO>>(
      `/comments/by-depth${buildQuery({ rootPostId, depth, ...(opts ?? {}) })}`,
    ),

  get: (id: string) => 
    http<CommentDTO>(`/comments/${id}`),
    
  create: (input: CreateCommentInput) =>
    http<CommentDTO>(`/comments`, { method: "POST", body: JSON.stringify(input) }),
    
  update: (id: string, input: UpdateCommentInput) =>
    http<CommentDTO>(`/comments/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    
  remove: (id: string) => 
    http<void>(`/comments/${id}`, { method: "DELETE" }),
};

// === Queries ===
export const commentQueries = {
  byRoot: (rootPostId: string) =>
    queryOptions({
      queryKey: commentKeys.byRoot(rootPostId),
      queryFn: () => commentApi.listByRoot(rootPostId),
    }),

  byDepth: (rootPostId: string, depth: number, offset?: number, limit?: number) =>
    queryOptions({
      queryKey: commentKeys.byDepth(rootPostId, depth, offset, limit),
      queryFn: () => commentApi.listByDepth(rootPostId, depth, { offset, limit }),
    }),

  byId: (id: string) =>
    queryOptions({
      queryKey: commentKeys.detail(id),
      queryFn: () => commentApi.get(id),
    }),
};
