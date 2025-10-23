import {queryOptions} from '@tanstack/react-query';
import {apiFetch} from './react-query/http.ts';
import {
  type ChapterListDTO,
  type ChapterDetailDTO,
  type CreateChapterInput,
  type UpdateChapterInput,
} from '@package/contract';

// === Query Keys ===
export const chapterKeys = {
  all: () => ['chapter'] as const,
  list: (bookId: string) => [...chapterKeys.all(), 'list', bookId] as const,
  detail: (id: number) => [...chapterKeys.all(), 'detail', id] as const,
};

// === API ===
export const chapterApi = {
  list: (bookId: string) =>
    apiFetch<ChapterListDTO>(`/books/${bookId}/chapters`),
  get: (id: number) => apiFetch<ChapterDetailDTO>(`/chapters/${id}`),
  create: (input: CreateChapterInput) =>
    apiFetch<ChapterDetailDTO>(`/chapters`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: number, input: UpdateChapterInput) =>
    apiFetch<ChapterDetailDTO>(`/chapters/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  remove: (id: number) => apiFetch<void>(`/chapters/${id}`, {method: 'DELETE'}),
};

// === Queries ===
export const chapterQueries = {
  list: (bookId: string) =>
    queryOptions({
      queryKey: chapterKeys.list(bookId),
      queryFn: () => chapterApi.list(bookId),
    }),

  byId: (id: number) =>
    queryOptions({
      queryKey: chapterKeys.detail(id),
      queryFn: () => chapterApi.get(id),
    }),
};
