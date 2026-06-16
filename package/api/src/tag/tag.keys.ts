/**
 * React Query keys for Tag queries
 * Tag 查询的 React Query 键。
 */

import type { TagFilters } from "./tag.types";

export const tagKeys = {
  all: () => ["tags"] as const,

  // list keys
  // 列表键
  lists: () => [...tagKeys.all(), "list"] as const,
  list: (filters?: TagFilters) => [...tagKeys.lists(), filters] as const,

  // detail
  // 详情
  details: () => [...tagKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...tagKeys.details(), unitId] as const,
  bySlug: (slug: string) => [...tagKeys.details(), "slug", slug] as const,

  // tags for a specific unit (scored associations)
  // 某个 unit 的标签（带评分的关联）
  forUnit: (unitId: string) => [...tagKeys.all(), "forUnit", unitId] as const,

  // tag context (global tags + realm highlights)
  // 标签上下文（全局标签 + realm 高亮）
  context: (unitId: string) => [...tagKeys.all(), "context", unitId] as const,

  // batch translations for a set of tag unit IDs in a language
  // 针对一组 tag unit ID 在某语言下的批量翻译
  translations: (tagUnitIds: string[], lang: string) =>
    [
      ...tagKeys.all(),
      "translations",
      [...tagUnitIds].sort().join(","),
      lang,
    ] as const,

  // votes
  // 投票
  votes: () => [...tagKeys.all(), "votes"] as const,

  // admin: low-score tag discovery
  // 管理端：低分标签发现
  lowScore: (params?: unknown) =>
    [...tagKeys.all(), "lowScore", params] as const,
} as const;
