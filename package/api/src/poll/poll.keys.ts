/**
 * React Query keys for Poll queries.
 * Poll 查询的 React Query 键。
 */

export const pollKeys = {
  all: () => ["polls"] as const,

  // a single poll's results (poll + options + tallies + caller's vote)
  // 单个 poll 的结果（poll + 选项 + 计票 + 调用方的投票）
  details: () => [...pollKeys.all(), "detail"] as const,
  detail: (pollUnitId: string) => [...pollKeys.details(), pollUnitId] as const,
} as const;
