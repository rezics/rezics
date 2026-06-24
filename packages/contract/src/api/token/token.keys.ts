/**
 * React Query key factory for Token queries
 * Follows the pattern used in other API modules (e.g. tag, comment).
 * Token 查询的 React Query key 工厂。
 * 遵循其他 API 模块（例如 tag、comment）使用的模式。
 */

export const tokenKeys = {
  /**
   * Base key for all token queries
   * 所有 token 查询的基础 key
   */
  all: () => ["tokens"] as const,

  /**
   * Keys for listing tokens of the current user
   * 列出当前用户 token 的 key
   */
  lists: () => [...tokenKeys.all(), "list"] as const,
  list: () => [...tokenKeys.lists()] as const,

  /**
   * Keys for individual token detail (by id)
   * 单个 token 详情的 key（按 id）
   */
  details: () => [...tokenKeys.all(), "detail"] as const,
  detail: (id: string) => [...tokenKeys.details(), id] as const,
} as const;
