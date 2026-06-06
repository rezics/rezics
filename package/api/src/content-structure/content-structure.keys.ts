export const contentStructureKeys = {
  all: () => ["contentStructure"] as const,
  details: () => [...contentStructureKeys.all(), "detail"] as const,
  detail: (ownerUnitId: string) =>
    [...contentStructureKeys.details(), ownerUnitId] as const,
} as const;
