// ANCHOR: federation.config
// ANCHOR: federation.config（联邦搜索权重配置）
// Default federation weights consumed by `multiSearch({ federation: ... })`.
// Tune these values here, not at call sites — clients do not need to update
// when these change. Higher weight = higher relative ranking pressure.
// `multiSearch({ federation: ... })` 使用的默认联邦权重。
// 在此处调整这些值，而不是在调用点——这些值变化时客户端无需更新。
// 权重越高 = 相对排名压力越大。

export const federationWeights = {
  content: 1.0,
  posts: 1.0,
  comments: 0.9,
  realms: 1.2,
  zones: 1.1,
  users: 1.5,
  entities: 1.2,
} as const;

export type FederationWeightKey = keyof typeof federationWeights;

// Default per-section item caps for the `category: "all"` grouped variant.
// `category: "all"` 分组变体下每个分区的默认条目上限。
export const DEFAULT_GROUPED_SECTION_LIMIT = 5;

// Default page size for `single` and `mixed` variants.
// `single` 和 `mixed` 变体的默认分页大小。
export const DEFAULT_PAGE_HITS_PER_PAGE = 20;
