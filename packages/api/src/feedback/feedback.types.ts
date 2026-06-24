/**
 * Feedback-related TypeScript types and interfaces for the frontend
 * 前端反馈相关的 TypeScript 类型与接口
 *
 * This file re-exports contract types so that UI code can import
 * from a single frontend-friendly location.
 * 该文件重新导出 contract 类型，使 UI 代码可以从单一的、面向前端的位置导入。
 */

import type {
  CreateFeedbackInput,
  FeedbackDTO,
  FeedbackListQuery,
  FeedbackType,
} from "@rezics/contract";

export type {
  CreateFeedbackInput,
  FeedbackDTO,
  FeedbackListQuery,
  FeedbackType,
};

/**
 * Extended frontend types
 * 扩展的前端类型
 */

// Currently identical to CreateFeedbackInput, but defined separately for UI layer customization
// 目前与 CreateFeedbackInput 相同，但单独定义以便 UI 层定制。
export type FeedbackFormData = CreateFeedbackInput;

// Filters used on the frontend for listing feedbacks
// 前端用于列出反馈的筛选条件。
export type FeedbackFilters = Partial<FeedbackListQuery>;
