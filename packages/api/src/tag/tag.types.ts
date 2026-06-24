/**
 * Tag-related TypeScript types and interfaces for the frontend
 * 面向前端的 tag 相关 TypeScript 类型与接口
 *
 * Tags are Units with type=TAG. They use UnitTranslation for labels,
 * scored tag junctions (UnitTag) for weighted associations, and voting.
 * Tag 是 type=TAG 的 Unit。它们使用 UnitTranslation 作为标签文本，使用带评分的
 * 标签关联表（UnitTag）实现加权关联，并支持投票。
 */

import type {
  AttachTagInput,
  CastTagVoteInput,
  CreateTagInput,
  DetachTagInput,
  TagListQuery,
  TagUnitDTO,
  TagVoteDTO,
  UnitTagDTO,
  UpdateTagInput,
} from "@rezics/contract";

// Re-export contract types
// 重新导出 contract 类型
export type {
  AttachTagInput,
  CastTagVoteInput,
  CreateTagInput,
  DetachTagInput,
  TagListQuery,
  TagUnitDTO,
  TagVoteDTO,
  UnitTagDTO,
  UpdateTagInput,
};

/**
 * Extended frontend types
 * 扩展的前端类型
 */
export type TagFormData = CreateTagInput;

export type TagFilters = Partial<TagListQuery>;

export type TagView = "list" | "cloud";
