/**
 * Tag-related TypeScript types and interfaces for the frontend
 *
 * Tags are Units with type=TAG. They use UnitTranslation for labels,
 * scored tag junctions (UnitTag) for weighted associations, and voting.
 */

import type {
  AttachTagInput,
  CastTagVoteInput,
  CreateTagInput,
  DetachTagInput,
  TagListQuery,
  TagVoteDTO,
  UnitTagDTO,
  UpdateTagInput,
} from "@rezics/contract";

// Re-export contract types
export type {
  AttachTagInput,
  CastTagVoteInput,
  CreateTagInput,
  DetachTagInput,
  TagListQuery,
  TagVoteDTO,
  UnitTagDTO,
  UpdateTagInput,
};

/**
 * Extended frontend types
 */
export type TagFormData = CreateTagInput;

export type TagFilters = Partial<TagListQuery>;

export type TagView = "list" | "cloud";
