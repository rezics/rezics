export const zoneKeys = {
  all: () => ["zones"] as const,
  lists: () => [...zoneKeys.all(), "list"] as const,
  mine: (query?: unknown) =>
    [...zoneKeys.lists(), "mine", query ?? null] as const,
  byUser: (userId: string, query?: unknown) =>
    [...zoneKeys.lists(), "user", userId, query ?? null] as const,
  details: () => [...zoneKeys.all(), "detail"] as const,
  detail: (slug: string, languages: readonly string[] = []) =>
    [...zoneKeys.details(), slug, [...languages]] as const,
  byUnitId: (unitId: string) =>
    [...zoneKeys.details(), "unit", unitId] as const,
  portal: (
    unitId: string,
    pageSlug: string,
    languages: readonly string[] = [],
  ) =>
    [...zoneKeys.byUnitId(unitId), "portal", pageSlug, [...languages]] as const,
  // Per-section data keys so one section's load-more never refetches the
  // others.
  // 按分区的数据键，使单个分区的「加载更多」不会重取其他分区。
  section: (
    unitId: string,
    pageId: string,
    sectionId: string,
    languages: readonly string[] = [],
  ) =>
    [
      ...zoneKeys.byUnitId(unitId),
      "section",
      pageId,
      sectionId,
      [...languages],
    ] as const,
} as const;
