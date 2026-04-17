export const translationGroupKeys = {
  all: () => ["translation-group"] as const,
  siblingsLists: () => [...translationGroupKeys.all(), "siblings"] as const,
  siblings: (unitId: string) =>
    [...translationGroupKeys.siblingsLists(), unitId] as const,
} as const;
