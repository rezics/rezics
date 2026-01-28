/**
 * Chapter-related TypeScript types and interfaces for the frontend
 */

import type {
  CreateChapterInput,
  UpdateChapterInput,
  ChapterListQuery,
  ChapterListResponse,
  ChapterResponse,
  ChapterListItemDTO,
  ChapterDetailDTO,
} from '@package/contract';

// Re-export contract types
export type {
  CreateChapterInput,
  UpdateChapterInput,
  ChapterListQuery,
  ChapterListResponse,
  ChapterResponse,
  ChapterListItemDTO,
  ChapterDetailDTO,
};

// Convenience alias for detail DTO as the primary Chapter DTO
export type ChapterDTO = ChapterDetailDTO;

/**
 * Extended frontend types
 */
export type ChapterFormData = Omit<CreateChapterInput, 'userId'>;

export type ChapterFilters = Partial<ChapterListQuery>;

export type ChapterSortOption = 'createdAt' | 'updatedAt';

export type ChapterView = 'list' | 'table' | 'grid';
