import { queryOptions } from "@tanstack/react-query";
import { http } from "./react-query/http.ts";
import { 
  type OffsetPaginated, 
  type OffsetPaginationParams,
  type ReadlistDTO,
  type CreateReadlistInput,
  type UpdateReadlistInput
} from "contract";

// === Query Keys ===
export const readlistKeys = {
  all: () => ["readlist"] as const,
  list: (offset?: number, limit?: number) => [...readlistKeys.all(), "list", { offset, limit }] as const,
  detail: (id: string) => [...readlistKeys.all(), "detail", id] as const,
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
export const readlistApi = {
  list: (params?: OffsetPaginationParams) => 
    http<OffsetPaginated<ReadlistDTO>>(`/readlists${buildPageQuery(params)}`),
  get: (id: string) => 
    http<ReadlistDTO>(`/readlists/${id}`),
  create: (input: CreateReadlistInput) =>
    http<ReadlistDTO>(`/readlists`, { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: UpdateReadlistInput) =>
    http<ReadlistDTO>(`/readlists/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => 
    http<void>(`/readlists/${id}`, { method: "DELETE" }),
};

// === Queries ===
export const readlistQueries = {
  list: (offset?: number, limit?: number) =>
    queryOptions({
      queryKey: readlistKeys.list(offset, limit),
      queryFn: () => readlistApi.list({ offset, limit }),
    }),

  byId: (id: string) =>
    queryOptions({
      queryKey: readlistKeys.detail(id),
      queryFn: () => readlistApi.get(id),
    }),
};
