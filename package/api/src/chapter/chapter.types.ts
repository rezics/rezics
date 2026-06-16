/**
 * Chapter-related TypeScript types and interfaces for the frontend
 * 前端使用的 chapter 相关 TypeScript 类型与接口
 */

import type {
  ChapterDetailDTO,
  ChapterListItemDTO,
  ChapterListQuery,
  ChapterListResponse,
  ChapterMaterializationRequest,
  ChapterMaterializationResponse,
  ChapterResponse,
  CreateChapterInput,
  UpdateChapterInput,
} from "@rezics/contract";

// Re-export contract types
// 重新导出契约类型
export type {
  ChapterDetailDTO,
  ChapterListItemDTO,
  ChapterListQuery,
  ChapterListResponse,
  ChapterMaterializationRequest,
  ChapterMaterializationResponse,
  ChapterResponse,
  CreateChapterInput,
  UpdateChapterInput,
};

// Primary chapter DTO used by app surfaces
// 应用各界面使用的主要 chapter DTO
export type ChapterDTO = ChapterDetailDTO;

/**
 * Extended frontend types
 * 扩展的前端类型
 */
export type ChapterFormData = Omit<CreateChapterInput, "userId">;

export type ChapterFilters = Partial<ChapterListQuery>;

export type ChapterSortOption = "createdAt" | "updatedAt";

export type ChapterView = "list" | "table" | "grid";
