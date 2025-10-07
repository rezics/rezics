import { queryOptions } from "@tanstack/react-query";
import { http } from "./react-query/http.ts";
import { 
  type ChapterListDTO, 
  type ChapterDetailDTO, 
  type CreateChapterInput, 
  type UpdateChapterInput 
} from "contract";

// === Query Keys ===
export const chapterKeys = {
  all: () => ["chapter"] as const,
  list: (bookId: string) => [...chapterKeys.all(), "list", bookId] as const,
  detail: (id: number) => [...chapterKeys.all(), "detail", id] as const,
};

// === API ===
export const chapterApi = {
  list: (bookId: string) => 
    http<ChapterListDTO>(`/books/${bookId}/chapters`),
  get: (id: number) => 
    http<ChapterDetailDTO>(`/chapters/${id}`),
  create: (input: CreateChapterInput) =>
    http<ChapterDetailDTO>(`/chapters`, { method: "POST", body: JSON.stringify(input) }),
  update: (id: number, input: UpdateChapterInput) =>
    http<ChapterDetailDTO>(`/chapters/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: number) => 
    http<void>(`/chapters/${id}`, { method: "DELETE" }),
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
