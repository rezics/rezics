import { queryOptions } from "@tanstack/react-query";
import { type ApiError, http } from "./react-query/http.ts";

// Chapter special structure:
// - Backend (mock) returns: { order: number[][] | number[], chapters: Array<{id,title,noContent}> }
// - We normalize to a tree with nodes map for O(1) lookup

export type ChapterNode = {
  id: number;
  title: string;
  noContent: boolean;
  children: ChapterNode[];
};

export type ChapterListDTO = {
  order: number[] | number[][];
  chapters: { id: number; title: string; noContent: boolean }[];
};

export type ChapterDetailDTO = {
  id: number;
  title: string;
  content?: string;
};

export const chapterKeys = {
  all: () => ["chapter"] as const,
  list: (bookId: string) => [...chapterKeys.all(), "list", bookId] as const,
  detail: (id: number) => [...chapterKeys.all(), "detail", id] as const,
};

export function buildChapterTree(dto: ChapterListDTO): ChapterNode[] {
  const chapterMap = new Map<number, ChapterNode>();
  for (const c of dto.chapters ?? []) {
    chapterMap.set(c.id, { ...c, children: [] });
  }

  const roots: ChapterNode[] = [];

  // order can be an array of arrays or a flat array per mock data
  const topLevel: number[] = Array.isArray(dto.order[0])
    ? (dto.order as number[][])[0]
    : (dto.order as number[]);

  const restLevels: number[][] = Array.isArray(dto.order[0])
    ? (dto.order as number[][]).slice(1)
    : [];

  // Attach top-level nodes
  for (const id of topLevel ?? []) {
    const node = chapterMap.get(id);
    if (node) roots.push(node);
  }

  // For subsequent levels, we link children in sequence under previous level nodes when possible.
  // If the mock provides flat order per parent id elsewhere, adapt accordingly later.
  let currentLevelNodes = roots;
  for (const levelIds of restLevels) {
    const nextLevelNodes: ChapterNode[] = [];
    for (const id of levelIds) {
      const node = chapterMap.get(id);
      if (!node) continue;
      nextLevelNodes.push(node);
    }
    // naive grouping: evenly or sequentially attach; fallback to append to last parent
    let parentIdx = 0;
    for (const child of nextLevelNodes) {
      const parent = currentLevelNodes[parentIdx] ?? currentLevelNodes[currentLevelNodes.length - 1];
      parent?.children.push(child);
      if (currentLevelNodes.length > 1) parentIdx = Math.min(parentIdx + 1, currentLevelNodes.length - 1);
    }
    currentLevelNodes = nextLevelNodes;
  }

  return roots;
}

// CRUD
export type CreateChapterInput = { bookId: string; title: string; content?: string; parentId?: number | null };
export type UpdateChapterInput = Partial<Omit<CreateChapterInput, "bookId">>;

export const chapterApi = {
  list: (bookId: string) => http<ChapterListDTO>(`/books/${bookId}/chapters`),
  get: (id: number) => http<ChapterDetailDTO>(`/chapters/${id}`),
  create: (input: CreateChapterInput) =>
    http<ChapterDetailDTO>(`/chapters`, { method: "POST", body: JSON.stringify(input) }),
  update: (id: number, input: UpdateChapterInput) =>
    http<ChapterDetailDTO>(`/chapters/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: number) => http<void>(`/chapters/${id}`, { method: "DELETE" }),
};

export const chapterQueries = {
  list: (bookId: string) =>
    queryOptions<ChapterListDTO, ApiError, ChapterNode[], ReturnType<typeof chapterKeys.list>>({
      queryKey: chapterKeys.list(bookId),
      queryFn: () => chapterApi.list(bookId),
      select: (dto) => buildChapterTree(dto),
    }),

  byId: (id: number) =>
    queryOptions<ChapterDetailDTO, ApiError, ChapterDetailDTO, ReturnType<typeof chapterKeys.detail>>({
      queryKey: chapterKeys.detail(id),
      queryFn: () => chapterApi.get(id),
    }),
};
