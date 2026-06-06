import type { FeedQuery } from "./feed.types";

export const feedKeys = {
  root: ["feed"] as const,
  rows: (query?: FeedQuery) =>
    [...feedKeys.root, "rows", query ?? null] as const,
};
