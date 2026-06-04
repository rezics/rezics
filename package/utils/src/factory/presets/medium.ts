import type { SeedPreset } from "@rezics/server/db/seed-factory";

// Medium fixed-content preset.
//
// Deterministic, mid-volume dataset. Mode is `fixed`, so every CountSpec
// resolves to its `target` (clamped to [min, max]). Designed to be fast to
// run while still exercising real-world relationships: 50 each of books /
// games / media, 40 tags, ~10 shelf placements per work (30 shelves × 50
// items / 150 works ≈ 10), 20 reviews per work, 100 tree posts per work.
export const medium: SeedPreset = {
  mode: "fixed",
  plan: {
    users: { min: 1, max: 50, target: 30 },
    tags: { min: 1, max: 60, target: 40 },
    books: { min: 1, max: 100, target: 50 },
    games: { min: 1, max: 100, target: 50 },
    media: { min: 1, max: 100, target: 50 },
    shelves: { min: 1, max: 60, target: 30 },
    realms: { min: 1, max: 20, target: 10 },
    zones: { min: 1, max: 40, target: 20 },
    personEntities: { min: 1, max: 200, target: 100 },
    organizationEntities: { min: 1, max: 60, target: 30 },
    followsPerUser: { min: 0, max: 10, target: 3 },
    favoriteItemsPerUser: { min: 0, max: 10, target: 5 },
    shelfItemCount: { min: 1, max: 100, target: 50 },
    scoresPerWork: { min: 0, max: 10, target: 3 },
    postsPerWork: {
      review: { min: 0, max: 40, target: 20 },
      excerpt: { min: 0, max: 20, target: 5 },
      remark: { min: 0, max: 20, target: 5 },
      tree: { min: 0, max: 200, target: 100 },
    },
    chapter: {
      count: { min: 1, max: 20, target: 5 },
      unitProbability: 0.2,
    },
    treeShape: {
      roots: { min: 1, max: 5, target: 2 },
      depth: { min: 0, max: 4, target: 2 },
      branching: { min: 1, max: 5, target: 2 },
    },
  },
};

export default medium;
