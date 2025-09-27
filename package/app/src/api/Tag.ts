import { queryOptions } from "@tanstack/react-query";
import { type ApiError, http } from "./react-query/http.ts";
import { type OffsetPaginated, type OffsetPaginationParams } from "./types";

export type TagDTO = {
  id: string;
  name: string;
  type?: string;
};

export const tagKeys = {
  all: () => ["tag"] as const,
  list: (offset?: number, limit?: number) => [...tagKeys.all(), "list", { offset, limit }] as const,
  detail: (id: string) => [...tagKeys.all(), "detail", id] as const,
};

export type CreateTagInput = { name: string; type?: string | null };
export type UpdateTagInput = Partial<CreateTagInput>;

const buildPageQuery = (params?: OffsetPaginationParams) => {
  const q = new URLSearchParams();
  if (params?.offset != null) q.set("offset", String(params.offset));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const tagApi = {
  list: (params?: OffsetPaginationParams) => http<OffsetPaginated<TagDTO>>(`/tags${buildPageQuery(params)}`),
  get: (id: string) => http<TagDTO>(`/tags/${id}`),
  create: (input: CreateTagInput) => http<TagDTO>(`/tags`, { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: UpdateTagInput) =>
    http<TagDTO>(`/tags/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => http<void>(`/tags/${id}`, { method: "DELETE" }),
};

export const tagQueries = {
  list: (offset?: number, limit?: number) =>
    queryOptions<OffsetPaginated<TagDTO>, ApiError, OffsetPaginated<TagDTO>, ReturnType<typeof tagKeys.list>>({
      queryKey: tagKeys.list(offset, limit),
      queryFn: () => tagApi.list({ offset, limit }),
    }),
  byId: (id: string) =>
    queryOptions<TagDTO, ApiError, TagDTO, ReturnType<typeof tagKeys.detail>>({
      queryKey: tagKeys.detail(id),
      queryFn: () => tagApi.get(id),
    }),
};
