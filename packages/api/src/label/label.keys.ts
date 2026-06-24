export const labelKeys = {
  all: () => ["labels"] as const,
  search: (q: string, limit?: number) =>
    [...labelKeys.all(), "search", q, limit ?? null] as const,
  list: (ids: readonly string[]) =>
    [...labelKeys.all(), "list", [...ids].sort()] as const,
} as const;
