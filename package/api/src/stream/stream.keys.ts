import type { StreamQuery } from "./stream.types";

export const streamKeys = {
  root: ["stream"] as const,
  rows: (query?: StreamQuery) =>
    [...streamKeys.root, "rows", query ?? null] as const,
};
