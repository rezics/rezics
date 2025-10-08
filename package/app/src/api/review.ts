import { queryOptions } from "@tanstack/react-query";
import { http } from "./react-query/http.ts";
import { 
  type OffsetPaginated, 
  type OffsetPaginationParams,
  type CommentDTO,
  type ReviewDTO,
  type QuoteDTO,
  type CreateReviewInput,
  type UpdateReviewInput
} from "contract";

// === Query Keys ===
export const reviewKeys = {
  all: () => ["review"] as const,
  list: (bookId?: string, limit?: number, offset?: number) =>
    [...reviewKeys.all(), "list", { bookId, limit, offset }] as const,
  quotes: (limit?: number) => [...reviewKeys.all(), "quotes", { limit }] as const,
  detail: (id: string) => [...reviewKeys.all(), "detail", id] as const,
  commentList: (bookId?: string, limit?: number) => [...reviewKeys.all(), "commentList", { bookId, limit }] as const,
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
export const reviewApi = {
  list: (opts?: { bookId?: string } & OffsetPaginationParams & { limit?: number }) =>
    http<OffsetPaginated<ReviewDTO>>(`/review${buildQuery(opts)}`),
  get: (id: string) => 
    http<ReviewDTO>(`/review/${id}`),
  create: (input: CreateReviewInput) => 
    http<ReviewDTO>(`/review`, { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: UpdateReviewInput) =>
    http<ReviewDTO>(`/review/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => 
    http<void>(`/review/${id}`, { method: "DELETE" }),

  quotes: (bookId: string, limit?: number) =>
    http<OffsetPaginated<QuoteDTO>>(`/quote/book/${bookId}${buildQuery({ limit })}`),
  commentList: (bookId: string, limit?: number) =>
    http<OffsetPaginated<CommentDTO>>(`/review/comment/book/${bookId}${buildQuery({ limit })}`),
};

// === Queries ===
export const reviewQueries = {
  list: (bookId?: string, limit?: number, offset?: number) =>
    queryOptions({
      queryKey: reviewKeys.list(bookId, limit, offset),
      queryFn: () => reviewApi.list({ bookId, limit, offset }),
    }),

  byId: (id: string) =>
    queryOptions({
      queryKey: reviewKeys.detail(id),
      queryFn: () => reviewApi.get(id),
    }),

  quoteList: (bookId: string, limit?: number) =>
    queryOptions({
      queryKey: reviewKeys.quotes(limit),
      queryFn: () => reviewApi.quotes(bookId, limit),
    }),

  commentList: (bookId: string, limit?: number) =>
    queryOptions({
      queryKey: reviewKeys.commentList(bookId, limit),
      queryFn: () => reviewApi.commentList(bookId, limit),
    }),
};
