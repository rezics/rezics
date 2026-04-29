import type { SeedPreset } from "../../../package/server/prisma/seed/mocks/types";

export const fast: SeedPreset = {
  mode: "realistic",
  plan: {
    users: { min: 0, max: 30, target: 30 },
    tags: { min: 0, max: 50, target: 50 },
    books: { min: 0, max: 50, target: 50 },
    games: { min: 0, max: 50, target: 50 },
    media: { min: 0, max: 50, target: 50 },
    shelves: { min: 0, max: 30, target: 30 },
    realms: { min: 0, max: 20, target: 20 },
    zones: { min: 0, max: 40, target: 40 },
    personEntities: { min: 0, max: 800, target: 800 },
    organizationEntities: { min: 0, max: 200, target: 200 },
    followsPerUser: { min: 0, max: 5, target: 5 },
    favoriteItemsPerUser: { min: 0, max: 8, target: 8 },
    shelfItemCount: { min: 3, max: 30, alpha: 1.5 },
    scoresPerWork: { min: 1, max: 3, target: 3 },
    postsPerWork: {
      review: { min: 0, max: 5, alpha: 1.8 },
      excerpt: { min: 0, max: 3, alpha: 2.0 },
      remark: { min: 0, max: 3, alpha: 2.0 },
      tree: { min: 0, max: 10, alpha: 1.8 },
    },
    chapter: {
      count: { min: 3, max: 30, alpha: 2.0 },
      unitProbability: 0.1,
    },
    treeShape: {
      roots: { min: 1, max: 4, alpha: 1.6 },
      depth: { min: 0, max: 3, alpha: 1.4 },
      branching: { min: 1, max: 3, alpha: 1.8 },
    },
  },
};

export default fast;
