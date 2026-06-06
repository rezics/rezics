import type { CommentListBody, CommentListQuery } from "@rezics/contract";

export const commentKeys = {
  all: () => ["comments"] as const,
  detail: (id: string) => [...commentKeys.all(), "detail", id] as const,
  list: (query: CommentListQuery | CommentListBody) =>
    [...commentKeys.all(), "list", query] as const,
} as const;
