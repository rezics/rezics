export const translationGroupKeys = {
  all: () => ["translation-group"] as const,
  siblingsLists: () => [...translationGroupKeys.all(), "siblings"] as const,
  siblings: (unitId: string) =>
    [...translationGroupKeys.siblingsLists(), unitId] as const,
  bestWikiPosts: (
    translationGroupIds: readonly string[],
    preferredLanguages: readonly string[],
  ) =>
    [
      ...translationGroupKeys.all(),
      "wiki-posts",
      "best",
      [...translationGroupIds].sort(),
      [...preferredLanguages],
    ] as const,
} as const;
