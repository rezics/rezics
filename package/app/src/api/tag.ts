import {queryOptions} from '@tanstack/react-query';
import {apiFetch} from './react-query/http.ts';
import {
  type TagDTO,
  type TagDetailDTO,
  type CreateTagInput,
  type UpdateTagInput,
  type TagListQuery,
} from '@package/contract';

// === Query Keys ===
export const tagKeys = {
  all: () => ['tag'] as const,
  list: (params?: Partial<TagListQuery>) =>
    [...tagKeys.all(), 'list', params ?? {}] as const,
  detail: (id: string) => [...tagKeys.all(), 'detail', id] as const,
};

// === Helper ===
const buildListQuery = (params?: Partial<TagListQuery>) => {
  const q = new URLSearchParams();
  if (!params) return '';
  if (params.q) q.set('q', params.q);
  if (params.type) q.set('type', params.type);
  if (params.domainId) q.set('domainId', params.domainId);
  if (params.objectId) q.set('objectId', params.objectId);
  if (params.page != null) q.set('page', String(params.page));
  if (params.limit != null) q.set('limit', String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : '';
};

// === API ===
export type TagListResponse = {tags: TagDTO[]; total: number};

export const tagApi = {
  list: (params?: Partial<TagListQuery>) =>
    apiFetch<TagListResponse>(`/tags${buildListQuery(params)}`),
  get: (id: string) => apiFetch<TagDetailDTO>(`/tags/${id}`),
  getByName: (
    name: string,
    type: string | null | undefined,
    domainId: string,
  ) => {
    const q = new URLSearchParams({name, domainId});
    if (type) q.set('type', type);
    return apiFetch<TagDetailDTO | null>(`/tags/by-name?${q.toString()}`);
  },
  create: (input: CreateTagInput) =>
    apiFetch<TagDetailDTO>(`/tags`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, input: UpdateTagInput) =>
    apiFetch<TagDetailDTO>(`/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    apiFetch<{message: string}>(`/tags/${id}`, {method: 'DELETE'}),
  attachToUnit: (tagUnitId: string, targetUnitId: string) =>
    apiFetch<{message: string}>(`/tags/${tagUnitId}/attach`, {
      method: 'POST',
      body: JSON.stringify({targetUnitId}),
    }),
  detachFromUnit: (tagUnitId: string, targetUnitId: string) =>
    apiFetch<{message: string}>(`/tags/${tagUnitId}/detach`, {
      method: 'POST',
      body: JSON.stringify({targetUnitId}),
    }),
};

// === Queries ===
export const tagQueries = {
  list: (params?: Partial<TagListQuery>) =>
    queryOptions({
      queryKey: tagKeys.list(params),
      queryFn: () => tagApi.list(params),
    }),
  byId: (id: string) =>
    queryOptions({
      queryKey: tagKeys.detail(id),
      queryFn: () => tagApi.get(id),
    }),
};
