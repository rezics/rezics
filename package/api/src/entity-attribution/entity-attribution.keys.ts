export const entityAttributionKeys = {
  all: () => ["entity-attribution"] as const,
  editor: (unitId: string) =>
    [...entityAttributionKeys.all(), "editor", unitId] as const,
} as const;
