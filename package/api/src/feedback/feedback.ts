/**
 * Feedback API - Main entry point
 * Provides a unified interface for all feedback-related operations
 * Feedback API - 主入口
 * 为所有 feedback 相关操作提供统一接口
 *
 * File organization:
 * 文件组织：
 * - feedback.types.ts: TypeScript types and interfaces。TypeScript 类型与接口
 * - feedback.keys.ts: React Query key factory。React Query 键工厂
 * - feedback.api.ts: API client functions。API 客户端函数
 * - feedback.queries.ts: Query configurations。查询配置
 * - feedback.mutations.ts: Mutation hooks。变更 hooks
 * - feedback.ts: Main entry (this file) - unified exports。主入口（本文件）——统一导出
 */

export { feedbackApi } from "./feedback.api";

export { feedbackKeys } from "./feedback.keys";
export {
  feedbackMutations,
  useCreateFeedbackMutation,
  useSetFeedbackResolvedMutation,
} from "./feedback.mutations";

export {
  feedbackDetailQuery,
  feedbackListQuery,
  feedbackQueries,
  feedbacksByUserQuery,
  myFeedbackListQuery,
} from "./feedback.queries";
export type {
  CreateFeedbackInput,
  FeedbackDTO,
  FeedbackFilters,
  FeedbackFormData,
  FeedbackListQuery,
} from "./feedback.types";
