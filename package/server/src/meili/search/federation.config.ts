// ANCHOR: federation.config
// Default federation weights consumed by `multiSearch({ federation: ... })`.
// Tune these values here, not at call sites — clients do not need to update
// when these change. Higher weight = higher relative ranking pressure.

export const federationWeights = {
  content: 1.0,
  posts: 1.0,
  realms: 1.2,
  users: 1.5,
  entities: 1.2,
} as const;

export type FederationWeightKey = keyof typeof federationWeights;

// Default per-section item caps for the `category: "all"` grouped variant.
export const DEFAULT_GROUPED_SECTION_LIMIT = 5;

// Default page size for `single` and `mixed` variants.
export const DEFAULT_PAGE_HITS_PER_PAGE = 20;
