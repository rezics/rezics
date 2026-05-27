import type { SeedPreset } from "@rezics/server/prisma/factory";

/**
 * Multi-link TOC preset. Seeds one or two small books where a sizeable share
 * of materialized chapters receive an additional ContentStructureNode row
 * inside the same book — exercising the "preface appears at top level and
 * again inside an appendix" pattern and the multi-link contract end-to-end
 * (no manual SQL required).
 */
export const bookMultiLinkToc: SeedPreset = {
  mode: "fixed",
  plan: {
    users: { min: 1, max: 5, target: 2 },
    tags: { min: 0, max: 10, target: 3 },
    books: { min: 1, max: 5, target: 2 },
    games: { min: 0, max: 5, target: 0 },
    media: { min: 0, max: 5, target: 0 },
    shelves: { min: 0, max: 5, target: 0 },
    realms: { min: 0, max: 5, target: 1 },
    zones: { min: 0, max: 5, target: 0 },
    personEntities: { min: 1, max: 10, target: 3 },
    organizationEntities: { min: 0, max: 5, target: 1 },
    followsPerUser: { min: 0, max: 5, target: 0 },
    favoriteItemsPerUser: { min: 0, max: 5, target: 0 },
    shelfItemCount: { min: 0, max: 5, target: 0 },
    scoresPerWork: { min: 0, max: 5, target: 0 },
    postsPerWork: {
      review: { min: 0, max: 2, target: 0 },
      excerpt: { min: 0, max: 2, target: 0 },
      remark: { min: 0, max: 2, target: 0 },
      tree: { min: 0, max: 2, target: 0 },
    },
    chapter: {
      count: { min: 4, max: 10, target: 6 },
      unitProbability: 1,
      multiLinkChapterProbability: 0.5,
    },
    treeShape: {
      roots: { min: 1, max: 3, target: 1 },
      depth: { min: 1, max: 2, target: 1 },
      branching: { min: 1, max: 3, target: 2 },
    },
  },
};

export default bookMultiLinkToc;
