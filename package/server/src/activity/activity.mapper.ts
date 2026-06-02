import type { ActivityItem, ActivityKind } from "@rezics/contract";

/** Map a stored `PostKind` to the activity item kind. */
export function postActivityKind(kind: string | null): ActivityKind {
  switch (kind) {
    case "REVIEW":
      return "review";
    case "REMARK":
      return "remark";
    default:
      return "post";
  }
}

/** App route for a post-derived activity item. */
export function postActivityHref(kind: ActivityKind, unitId: string): string {
  switch (kind) {
    case "review":
      return `/review/${unitId}`;
    case "remark":
      return `/remark/${unitId}`;
    default:
      return `/post/${unitId}`;
  }
}

/** App route for a shelf-update activity item. */
export function shelfActivityHref(unitId: string): string {
  return `/shelf/${unitId}`;
}

function extractExtraTitle(extra: unknown): string | undefined {
  if (extra && typeof extra === "object" && "title" in extra) {
    const value = (extra as { title?: unknown }).title;
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

export function resolvePostActivityTitle(input: {
  translations: Array<{ language: string; title: string | null }>;
  defaultLanguage?: string | null;
  supportLanguages?: Array<{
    language: string;
    isPrimary: boolean;
    sortOrder: number;
  }>;
  extra?: unknown;
}): string | undefined {
  const order = [
    input.defaultLanguage,
    input.supportLanguages?.find((language) => language.isPrimary)?.language,
    ...(input.supportLanguages ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((language) => language.language),
    ...input.translations.map((translation) => translation.language),
  ];
  const titleByLanguage = new Map(
    input.translations.map((translation) => [
      translation.language,
      translation.title,
    ]),
  );
  for (const language of [
    ...new Set(order.filter((language): language is string => !!language)),
  ]) {
    const title = titleByLanguage.get(language);
    if (title?.trim()) return title.trim();
  }
  return extractExtraTitle(input.extra);
}

/**
 * Merge heterogeneous activity items into a single time-descending page.
 * `nextCursor` is the `at` of the last returned item when more remain, so the
 * caller re-queries every source with `before = nextCursor`.
 */
export function mergeActivity(
  items: ActivityItem[],
  limit: number,
): { items: ActivityItem[]; nextCursor: string | null } {
  const sorted = [...items].sort((a, b) => {
    const byTime = b.at.localeCompare(a.at);
    if (byTime !== 0) return byTime;
    return b.id.localeCompare(a.id);
  });
  const page = sorted.slice(0, limit);
  const nextCursor =
    sorted.length > limit && page.length > 0 ? page[page.length - 1]!.at : null;
  return { items: page, nextCursor };
}
