import type { CommentListBody, CommentListQuery } from "@rezics/contract";

export const commentKeys = {
  all: () => ["comments"] as const,
  detail: (unitId: string) => [...commentKeys.all(), "detail", unitId] as const,
  list: (query: CommentListQuery | CommentListBody) =>
    [...commentKeys.all(), "list", query] as const,
} as const;
