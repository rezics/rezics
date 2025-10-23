import {queryOptions} from '@tanstack/react-query';
import {apiFetch} from './react-query/http.ts';
import {
  type OffsetPaginated,
  type OffsetPaginationParams,
  type UserDTO,
  type CreateUserInput,
  type UpdateUserInput,
} from '@package/contract';

// === Query Keys ===
export const userKeys = {
  all: () => ['user'] as const,
  me: () => [...userKeys.all(), 'me'] as const,
  list: (offset?: number, limit?: number) =>
    [...userKeys.all(), 'list', {offset, limit}] as const,
  detail: (id: string) => [...userKeys.all(), 'detail', id] as const,
};

// === Helper ===
const buildPageQuery = (params?: OffsetPaginationParams) => {
  const q = new URLSearchParams();
  if (params?.offset != null) q.set('offset', String(params.offset));
  if (params?.limit != null) q.set('limit', String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : '';
};

// === API ===
export const userApi = {
  list: (params?: OffsetPaginationParams) =>
    apiFetch<OffsetPaginated<UserDTO>>(`/users${buildPageQuery(params)}`),
  get: (id: string) => apiFetch<UserDTO>(`/users/${id}`),
  me: () => apiFetch<UserDTO>(`/users/me`),
  create: (input: CreateUserInput) =>
    apiFetch<UserDTO>(`/users`, {method: 'POST', body: JSON.stringify(input)}),
  update: (id: string, input: UpdateUserInput) =>
    apiFetch<UserDTO>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  remove: (id: string) => apiFetch<void>(`/users/${id}`, {method: 'DELETE'}),
};

// === Queries ===
export const userQueries = {
  me: () =>
    queryOptions({
      queryKey: userKeys.me(),
      queryFn: () => userApi.me(),
    }),
  list: (offset?: number, limit?: number) =>
    queryOptions({
      queryKey: userKeys.list(offset, limit),
      queryFn: () => userApi.list({offset, limit}),
    }),
  byId: (id: string) =>
    queryOptions({
      queryKey: userKeys.detail(id),
      queryFn: () => userApi.get(id),
    }),
};
