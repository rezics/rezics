/**
 * Tag-related TypeScript types and interfaces for the frontend
 */

import type {
  TagDTO,
  TagDetailDTO,
  CreateTagInput,
  UpdateTagInput,
  TagListQuery,
} from '@rezics/contract';

// Re-export contract types
export type {
  TagDTO,
  TagDetailDTO,
  CreateTagInput,
  UpdateTagInput,
  TagListQuery,
};

/**
 * Extended frontend types
 */
export type TagFormData = Omit<CreateTagInput, never>;

export type TagFilters = Partial<TagListQuery>;

export type TagView = 'list' | 'cloud';
