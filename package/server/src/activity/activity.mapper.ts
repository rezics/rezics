import type { ActivityItem, ActivityKind } from "@rezics/contract";

/** Map a stored `PostKind` to the activity item kind. 将存储的 `PostKind` 映射为活动条目的 kind。 */
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

/** App route for a post-derived activity item. 由 post 派生的活动条目的应用路由。 */
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

/** App route for a shelf-update activity item. 书架更新活动条目的应用路由。 */
export function shelfActivityHref(unitId: string): string {
  return `/shelf/${unitId}`;
}

export function resolvePostActivityTitle(input: {
  translations: Array<{ language: string; title: string | null }>;
  defaultLanguage?: string | null;
  supportLanguages?: Array<{
    language: string;
    isPrimary: boolean;
    position: string;
  }>;
  extra?: unknown;
}): string | undefined {
  const order = [
    input.defaultLanguage,
    input.supportLanguages?.find((language) => language.isPrimary)?.language,
    ...(input.supportLanguages ?? [])
      .sort((a, b) => a.position.localeCompare(b.position))
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
  return undefined;
}

/**
 * Merge heterogeneous activity items into a single time-descending page.
 * `nextCursor` is the `at` of the last returned item when more remain, so the
 * caller re-queries every source with `before = nextCursor`.
 * 将异构的活动条目合并为单个按时间降序的分页。
 * 当仍有更多条目时，`nextCursor` 是最后一条返回条目的 `at`，因此调用方会以
 * `before = nextCursor` 重新查询每个数据源。
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
