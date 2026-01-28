/**
 * Readlist-related TypeScript types and interfaces for the frontend
 */

import type {
  ReadlistDTO,
  CreateReadlistInput,
  UpdateReadlistInput,
  ReadlistListQuery,
} from '@package/contract';

// Re-export contract types
export type {
  ReadlistDTO,
  CreateReadlistInput,
  UpdateReadlistInput,
  ReadlistListQuery,
};

/**
 * Extended frontend types
 */
export type ReadlistFormData = Omit<CreateReadlistInput, 'userId'>;

export type ReadlistFilters = Partial<ReadlistListQuery>;

export type ReadlistSortOption =
  | 'createdAt'
  | 'updatedAt'
  | 'publishedAt'
  | 'likeCount'
  | 'commentCount'
  | 'viewCount';

export type ReadlistView = 'grid' | 'list' | 'table';
