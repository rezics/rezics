import type { SeedPreset } from "@rezics/server/db/seed-factory";

// Post-tree debugging preset.
//
// Produces a single book, game, and media with exactly one review each and a
// post-tree of known shape. Under fixed mode every CountSpec resolves to its
// target (clamped to [min, max]):
//
//   roots:     1     → 1 root post per work
//   depth:     2     → tree reaches depth 2 (root → reply → reply)
//   branching: 3     → every non-leaf has 3 direct children
//
// The reply allocation `total - roots` produces exactly 3 + 9 = 12 reply slots
// per root when the tree-post total resolves to 1 + 3 + 9 = 13. We use that
// value as the tree-post target so a full balanced ternary tree of depth 2 is
// drawn deterministically.
//
// post-tree 调试预设。
//
// 生成单个 book、game 和 media，每个恰好带一条 review，以及一棵形状已知的
// post-tree。在 fixed 模式下，每个 CountSpec 都解析为其 target（被钳制到
// [min, max] 内）：
//
//   roots:     1     → 每个 work 1 个根 post
//   depth:     2     → 树达到深度 2（root → reply → reply）
//   branching: 3     → 每个非叶节点有 3 个直接子节点
//
// 当 tree-post 总数解析为 1 + 3 + 9 = 13 时，回复分配 `total - roots` 恰好
// 为每个根产出 3 + 9 = 12 个回复槽。我们以该值作为 tree-post target，从而
// 确定性地绘制出一棵深度为 2 的完整平衡三叉树。
export const postTreeFocus: SeedPreset = {
  mode: "fixed",
  plan: {
    users: { min: 1, max: 10, target: 3 },
    tags: { min: 1, max: 10, target: 3 },
    books: { min: 1, max: 5, target: 1 },
    games: { min: 1, max: 5, target: 1 },
    media: { min: 1, max: 5, target: 1 },
    shelves: { min: 0, max: 5, target: 1 },
    realms: { min: 1, max: 5, target: 2 },
    zones: { min: 0, max: 5, target: 1 },
    personEntities: { min: 1, max: 10, target: 3 },
    organizationEntities: { min: 1, max: 10, target: 1 },
    followsPerUser: { min: 0, max: 5, target: 0 },
    favoriteItemsPerUser: { min: 0, max: 5, target: 0 },
    shelfItemCount: { min: 0, max: 5, target: 1 },
    scoresPerWork: { min: 0, max: 5, target: 1 },
    postsPerWork: {
      review: { min: 0, max: 5, target: 1 },
      excerpt: { min: 0, max: 5, target: 0 },
      remark: { min: 0, max: 5, target: 0 },
      tree: { min: 0, max: 50, target: 13 },
    },
    chapter: {
      count: { min: 1, max: 10, target: 3 },
      unitProbability: 1,
    },
    treeShape: {
      roots: { min: 1, max: 5, target: 1 },
      depth: { min: 1, max: 4, target: 2 },
      branching: { min: 1, max: 5, target: 3 },
    },
  },
};

export default postTreeFocus;
