/**
 * Unit-related TypeScript types and interfaces for the frontend
 */

import type {
  CommentTreeNode,
  CommentTreeQuery,
  CommentTreeResponse,
  CreateUnitInput,
  UnitDTO,
  UnitListQuery,
  UnitListResponse,
  UnitResponse,
  UpdateUnitInput,
} from "@rezics/contract";

// Re-export contract types
export type {
  CommentTreeNode,
  CommentTreeQuery,
  CommentTreeResponse,
  CreateUnitInput,
  UnitDTO,
  UnitListQuery,
  UnitListResponse,
  UnitResponse,
  UpdateUnitInput,
};

/**
 * Extended frontend types
 */
export type UnitFormData = Omit<CreateUnitInput, "userId">;

export type UnitFilters = Partial<UnitListQuery>;

export type UnitSortOption = "createdAt" | "updatedAt" | "publishedAt";

export type UnitView = "grid" | "list";
