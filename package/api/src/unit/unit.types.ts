/**
 * Unit-related TypeScript types and interfaces for the frontend
 */

import type {
  UnitDTO,
  CreateUnitInput,
  UpdateUnitInput,
  UnitListQuery,
  UnitResponse,
  UnitListResponse,
  CommentTreeQuery,
  CommentTreeResponse,
  CommentTreeNode,
} from '@package/contract';

// Re-export contract types
export type {
  UnitDTO,
  CreateUnitInput,
  UpdateUnitInput,
  UnitListQuery,
  UnitResponse,
  UnitListResponse,
  CommentTreeQuery,
  CommentTreeResponse,
  CommentTreeNode,
};

/**
 * Extended frontend types
 */
export type UnitFormData = Omit<CreateUnitInput, 'userId'>;

export type UnitFilters = Partial<UnitListQuery>;

export type UnitSortOption = 'createdAt' | 'updatedAt' | 'publishedAt';

export type UnitView = 'grid' | 'list';
