/**
 * Shelf-related TypeScript types and interfaces for the frontend
 *
 * Shelf replaces Readlist. Shelves contain items (ShelfItem) that reference
 * other units, support translations, and can be categorized by kindKey.
 */

import type {
  AddShelfItemInput,
  CreateShelfInput,
  ShelfDTO,
  ShelfItemDTO,
  ShelfListQuery,
  ShelfListResponse,
  ShelfResponse,
  UpdateShelfInput,
  UpdateShelfItemInput,
} from "@rezics/contract";

// Re-export contract types
export type {
  AddShelfItemInput,
  CreateShelfInput,
  ShelfDTO,
  ShelfItemDTO,
  ShelfListQuery,
  ShelfListResponse,
  ShelfResponse,
  UpdateShelfInput,
  UpdateShelfItemInput,
};

/**
 * Extended frontend types
 */
export type ShelfFormData = CreateShelfInput;

export type ShelfFilters = Partial<ShelfListQuery>;

export type ShelfSortOption = "createdAt" | "updatedAt";

export type ShelfView = "grid" | "list" | "table";
