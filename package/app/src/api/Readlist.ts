import { queryOptions } from "@tanstack/react-query";
import { type ApiError, http } from "./react-query/http.ts";
import { type OffsetPaginated, type OffsetPaginationParams } from "./types";

export type ReadlistDTO = {
  id: string;
  title: string;
  coverUrl?: string;
  creator?: { id?: string; name: string; avatar?: string };
  likes?: number;
};

export const readlistKeys = {
  all: () => ["readlist"] as const,
  list: (offset?: number, limit?: number) => [...readlistKeys.all(), "list", { offset, limit }] as const,
  detail: (id: string) => [...readlistKeys.all(), "detail", id] as const,
};

export type CreateReadlistInput = {
  title: string;
  coverUrl?: string;
  bookIds?: string[];
};
export type UpdateReadlistInput = Partial<CreateReadlistInput>;

const buildPageQuery = (params?: OffsetPaginationParams) => {
  const q = new URLSearchParams();
  if (params?.offset != null) q.set("offset", String(params.offset));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const readlistApi = {
  list: (params?: OffsetPaginationParams) => http<OffsetPaginated<ReadlistDTO>>(`/readlists${buildPageQuery(params)}`),
  get: (id: string) => http<ReadlistDTO>(`/readlists/${id}`),
  create: (input: CreateReadlistInput) =>
    http<ReadlistDTO>(`/readlists`, { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: UpdateReadlistInput) =>
    http<ReadlistDTO>(`/readlists/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => http<void>(`/readlists/${id}`, { method: "DELETE" }),
};

export const readlistQueries = {
  list: (offset?: number, limit?: number) =>
    queryOptions<
      OffsetPaginated<ReadlistDTO>,
      ApiError,
      OffsetPaginated<ReadlistDTO>,
      ReturnType<typeof readlistKeys.list>
    >({
      queryKey: readlistKeys.list(offset, limit),
      queryFn: () => readlistApi.list({ offset, limit }),
    }),

  byId: (id: string) =>
    queryOptions<ReadlistDTO, ApiError, ReadlistDTO, ReturnType<typeof readlistKeys.detail>>({
      queryKey: readlistKeys.detail(id),
      queryFn: () => readlistApi.get(id),
    }),
};
