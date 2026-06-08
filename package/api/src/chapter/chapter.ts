/**
 * Chapter API - Main entry point
 * Provides a unified interface for all chapter-related operations
 * 章节 API —— 主入口
 * 为所有章节相关操作提供统一接口
 *
 * File organization:
 * 文件组织：
 * - chapter.types.ts: TypeScript types and interfaces。TypeScript 类型与接口。
 * - chapter.keys.ts: React Query key factory。React Query 键工厂。
 * - chapter.api.ts: API client functions。API 客户端函数。
 * - chapter.queries.ts: Query configurations。查询配置。
 * - chapter.mutations.ts: Mutation hooks。变更钩子。
 * - chapter.ts: Main entry (this file) - unified exports。主入口（本文件）—— 统一导出。
 */

// API Client
// API 客户端
export { chapterApi } from "./chapter.api";

// Query Keys
// 查询键
export { chapterKeys } from "./chapter.keys";
// Mutation Hooks
// 变更钩子
export {
  chapterMutations,
  useCreateChapterMutation,
  useDeleteChapterMutation,
  useUpdateChapterMutation,
} from "./chapter.mutations";

// Query Configurations
// 查询配置
export {
  chapterDetailQuery,
  chapterInfiniteListQuery,
  chapterListQuery,
  chapterQueries,
  chapterSearchQuery,
  chaptersByTargetUnitQuery,
  chaptersByUserQuery,
} from "./chapter.queries";
// Types
// 类型
export type {
  ChapterDetailDTO,
  ChapterDTO,
  ChapterFilters,
  ChapterFormData,
  ChapterListItemDTO,
  ChapterListQuery,
  ChapterListResponse,
  ChapterResponse,
  ChapterSortOption,
  ChapterView,
  CreateChapterInput,
  UpdateChapterInput,
} from "./chapter.types";
