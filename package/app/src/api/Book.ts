import { queryOptions } from "@tanstack/react-query";
import { http } from "./react-query/http.ts";
import { 
  type OffsetPaginated, 
  type OffsetPaginationParams, 
  type BookDTO, 
  type CreateBookInput, 
  type UpdateBookInput 
} from "contract";

// === Query Keys ===
export const bookKeys = {
  all: () => ["book"] as const,
  lists: () => [...bookKeys.all(), "list"] as const,
  list: (offset?: number, limit?: number) => [...bookKeys.lists(), { offset, limit }] as const,
  details: () => [...bookKeys.all(), "detail"] as const,
  detail: (id: string) => [...bookKeys.details(), id] as const,
};

// === Helper ===
const buildPageQuery = (params?: OffsetPaginationParams) => {
  const q = new URLSearchParams();
  if (params?.offset != null) q.set("offset", String(params.offset));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : "";
};

// === API ===
export const bookApi = {
  list: (params?: OffsetPaginationParams) => 
    http<OffsetPaginated<BookDTO>>(`/book/list${buildPageQuery(params)}`),
  get: (id: string) => 
    http<BookDTO>(`/book/${id}`),
  create: (input: CreateBookInput) => 
    http<BookDTO>("/books", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: UpdateBookInput) =>
    http<BookDTO>(`/book/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => 
    http<void>(`/book/${id}`, { method: "DELETE" }),
};

// === Queries ===
export const bookQueries = {
  list: (offset?: number, limit?: number) =>
    queryOptions({
      queryKey: bookKeys.list(offset, limit),
      queryFn: () => bookApi.list({ offset, limit }),
    }),

  byId: (id: string) =>
    queryOptions({
      queryKey: bookKeys.detail(id),
      queryFn: () => bookApi.get(id),
    }),
};
