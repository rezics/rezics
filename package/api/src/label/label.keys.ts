export const labelKeys = {
  all: () => ["labels"] as const,
  search: (q: string, limit?: number) =>
    [...labelKeys.all(), "search", q, limit ?? null] as const,
} as const;
