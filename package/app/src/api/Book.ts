import { queryOptions } from "@tanstack/react-query";
import { type ApiError, http } from "./react-query/http.ts";
import { type OffsetPaginated, type OffsetPaginationParams, type BookDTO, type CreateBookInput, type UpdateBookInput } from "contract";

// === DTOs (server contracts) ===
// BookDTO comes from contract

// === Views (UI consumption) ===
export type BookListItem = Pick<BookDTO, "id" | "title"> & {
  coverUrl?: string;
};

export type BookDetail = BookDTO & {
  authors: { id: string; name: string; avatar?: string; description?: string }[];
};

// === Query Keys ===
export const bookKeys = {
  all: () => ["book"] as const,
  lists: () => [...bookKeys.all(), "list"] as const,
  list: (offset?: number, limit?: number) => [...bookKeys.lists(), { offset, limit }] as const,
  details: () => [...bookKeys.all(), "detail"] as const,
  detail: (id: string) => [...bookKeys.details(), id] as const,
};

// === HTTP helpers (CRUD) ===
// CreateBookInput / UpdateBookInput from contract

const buildPageQuery = (params?: OffsetPaginationParams) => {
  const q = new URLSearchParams();
  if (params?.offset != null) q.set("offset", String(params.offset));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const bookApi = {
  list: (params?: OffsetPaginationParams) => http<OffsetPaginated<BookDTO>>(`/book/list${buildPageQuery(params)}`),
  get: (id: string) => http<BookDTO>(`/book/${id}`),
  create: (input: CreateBookInput) => http<BookDTO>("/books", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: UpdateBookInput) =>
    http<BookDTO>(`/book/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => http<void>(`/book/${id}`, { method: "DELETE" }),
};

// === Query Factories ===
export const bookQueries = {
  list: (offset?: number, limit?: number) =>
    queryOptions<OffsetPaginated<BookDTO>, ApiError, OffsetPaginated<BookListItem>, ReturnType<typeof bookKeys.list>>({
      queryKey: bookKeys.list(offset, limit),
      queryFn: () => bookApi.list({ offset, limit }),
      // select: (res) => ({
      //   items: (res.items ?? []).map((b) => ({
      //     id: String(b.id),
      //     title: String(b.title ?? ""),
      //     coverUrl: b.coverUrl,
      //   })),
      //   offset: res.offset,
      //   totalItems: res.totalItems,
      // }),
    }),

  byId: (id: string) =>
    queryOptions<BookDTO, ApiError, BookDetail, ReturnType<typeof bookKeys.detail>>({
      queryKey: bookKeys.detail(id),
      queryFn: () => bookApi.get(id),
      select: (b) => ({
        id: String(b.id ?? id),
        title: String(b.title ?? ""),
        authors: Array.isArray(b.authors)
          ? b.authors.map((u) => ({
            id: String(u.id),
            name: String(u.name ?? ""),
            avatar: u.avatar,
            description: u.description,
          }))
          : [],
        coverUrl: b.coverUrl,
        isbn: b.isbn,
        description: b.description,
        extra: b.extra,
      }),
    }),
};
