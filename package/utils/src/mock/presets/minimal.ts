import type { SeedPreset } from "@rezics/server/prisma/mock";

export const minimal: SeedPreset = {
  mode: "fixed",
  plan: {
    users: { min: 0, max: 10, target: 5 },
    tags: { min: 0, max: 20, target: 10 },
    books: { min: 0, max: 10, target: 3 },
    games: { min: 0, max: 10, target: 3 },
    media: { min: 0, max: 10, target: 3 },
    shelves: { min: 0, max: 10, target: 3 },
    realms: { min: 0, max: 10, target: 2 },
    zones: { min: 0, max: 10, target: 2 },
    personEntities: { min: 0, max: 20, target: 10 },
    organizationEntities: { min: 0, max: 20, target: 5 },
    followsPerUser: { min: 0, max: 5, target: 1 },
    favoriteItemsPerUser: { min: 0, max: 5, target: 1 },
    shelfItemCount: { min: 1, max: 10, target: 2 },
    scoresPerWork: { min: 0, max: 5, target: 1 },
    postsPerWork: {
      review: { min: 0, max: 5, target: 1 },
      excerpt: { min: 0, max: 5, target: 1 },
      remark: { min: 0, max: 5, target: 1 },
      tree: { min: 0, max: 5, target: 1 },
    },
    chapter: {
      count: { min: 1, max: 10, target: 3 },
      unitProbability: 1,
    },
    treeShape: {
      roots: { min: 1, max: 3, target: 1 },
      depth: { min: 0, max: 2, target: 1 },
      branching: { min: 1, max: 3, target: 1 },
    },
  },
};

export default minimal;
