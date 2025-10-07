/**
 * Book-related TypeScript types and interfaces for the frontend
 */

import type {BookDTO, CreateBookInput, UpdateBookInput, BookSearchParams} from 'contract';

// Re-export contract types
export type {BookDTO, CreateBookInput, UpdateBookInput, BookSearchParams};

/**
 * Extended frontend types
 */
export type BookFormData = Omit<CreateBookInput, 'userId'>;

export type BookFilters = Partial<BookSearchParams>;

export type BookSortOption = 'title' | 'createdAt' | 'updatedAt';

export type BookView = 'grid' | 'list' | 'table';
