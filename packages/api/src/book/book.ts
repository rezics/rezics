/**
 * Book API - Main entry point
 * Provides a unified interface for all book-related operations
 * 书籍 API —— 主入口
 * 为所有书籍相关操作提供统一接口
 *
 * File organization:
 * 文件组织：
 * - book.types.ts: TypeScript types and interfaces。TypeScript 类型与接口。
 * - book.keys.ts: React Query key factory。React Query 键工厂。
 * - book.api.ts: API client functions。API 客户端函数。
 * - book.queries.ts: Query configurations。查询配置。
 * - book.mutations.ts: Mutation hooks。变更钩子。
 * - book.ts: Main entry (this file) - unified exports。主入口（本文件）—— 统一导出。
 */

// API Client
// API 客户端
export { bookApi } from "./book.api";

// Query Keys
// 查询键
export { bookKeys } from "./book.keys";
// Mutation Hooks
// 变更钩子
export {
  bookMutations,
  useCreateBookMutation,
  useDeleteBookMutation,
  useUpdateBookMutation,
  useUpdateContentStructureMutation,
} from "./book.mutations";

// Query Configurations
// 查询配置
export {
  bookByIsbnQuery,
  bookContentStructureQuery,
  bookDetailQuery,
  bookInfiniteListQuery,
  bookListQuery,
  bookQueries,
  bookRatingQuery,
  bookSearchQuery,
  booksByEntityQuery,
  booksByTagsQuery,
  booksByUserQuery,
} from "./book.queries";
// Types
// 类型
export type {
  BookContentStructureResponse,
  BookDTO,
  BookFilters,
  BookFormData,
  BookListResponse,
  BookResponse,
  BookSortOption,
  BookView,
  CreateBookInput,
  UpdateBookInput,
} from "./book.types";
