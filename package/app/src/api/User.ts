import { queryOptions } from "@tanstack/react-query";
import { type ApiError, http } from "./react-query/http.ts";
import { type OffsetPaginated, type OffsetPaginationParams } from "./types";

export type UserDTO = {
  id: string;
  email?: string;
  slug?: string;
  name: string;
  avatar?: string;
  bio?: string;
  joinDate?: string;
};

export const userKeys = {
  all: () => ["user"] as const,
  me: () => [...userKeys.all(), "me"] as const,
  list: (offset?: number, limit?: number) => [...userKeys.all(), "list", { offset, limit }] as const,
  detail: (id: string) => [...userKeys.all(), "detail", id] as const,
};

export type CreateUserInput = {
  email: string;
  password: string;
  name: string;
  avatar?: string;
  bio?: string;
};

export type UpdateUserInput = Partial<Omit<CreateUserInput, "password">> & { password?: string };

const buildPageQuery = (params?: OffsetPaginationParams) => {
  const q = new URLSearchParams();
  if (params?.offset != null) q.set("offset", String(params.offset));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const userApi = {
  list: (params?: OffsetPaginationParams) => http<OffsetPaginated<UserDTO>>(`/users${buildPageQuery(params)}`),
  get: (id: string) => http<UserDTO>(`/users/${id}`),
  me: () => http<UserDTO>(`/users/me`),
  create: (input: CreateUserInput) => http<UserDTO>(`/users`, { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: UpdateUserInput) =>
    http<UserDTO>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => http<void>(`/users/${id}`, { method: "DELETE" }),
};

export const userQueries = {
  me: () =>
    queryOptions<UserDTO, ApiError, UserDTO, ReturnType<typeof userKeys.me>>({
      queryKey: userKeys.me(),
      queryFn: () => userApi.me(),
    }),
  list: (offset?: number, limit?: number) =>
    queryOptions<OffsetPaginated<UserDTO>, ApiError, OffsetPaginated<UserDTO>, ReturnType<typeof userKeys.list>>({
      queryKey: userKeys.list(offset, limit),
      queryFn: () => userApi.list({ offset, limit }),
    }),
  byId: (id: string) =>
    queryOptions<UserDTO, ApiError, UserDTO, ReturnType<typeof userKeys.detail>>({
      queryKey: userKeys.detail(id),
      queryFn: () => userApi.get(id),
    }),
};
