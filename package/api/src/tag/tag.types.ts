/**
 * Tag-related TypeScript types and interfaces for the frontend
 */

import type {
  CreateTagInput,
  TagDetailDTO,
  TagDTO,
  TagListQuery,
  UpdateTagInput,
} from "@rezics/contract";

// Re-export contract types
export type {
  CreateTagInput,
  TagDetailDTO,
  TagDTO,
  TagListQuery,
  UpdateTagInput,
};

/**
 * Extended frontend types
 */
export type TagFormData = Omit<CreateTagInput, never>;

export type TagFilters = Partial<TagListQuery>;

export type TagView = "list" | "cloud";
