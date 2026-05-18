/**
 * Chapter-related TypeScript types and interfaces for the frontend
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
export type ChapterDTO = ChapterDetailDTO;

/**
 * Extended frontend types
 */
export type ChapterFormData = Omit<CreateChapterInput, "userId">;

export type ChapterFilters = Partial<ChapterListQuery>;

export type ChapterSortOption = "createdAt" | "updatedAt";

export type ChapterView = "list" | "table" | "grid";
