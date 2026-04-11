/**
 * Unit-related TypeScript types and interfaces for the frontend
 */

import type {
  CreateUnitInput,
  UnitDTO,
  UnitListQuery,
  UnitListResponse,
  UnitResponse,
  UnitTranslationDTO,
  UpdateUnitInput,
} from "@rezics/contract";

// Re-export contract types
export type {
  CreateUnitInput,
  UnitDTO,
  UnitListQuery,
  UnitListResponse,
  UnitResponse,
  UnitTranslationDTO,
  UpdateUnitInput,
};

/**
 * Extended frontend types
 */
export type UnitFormData = Omit<CreateUnitInput, "userId">;

export type UnitFilters = Partial<UnitListQuery>;

export type UnitSortOption = "createdAt" | "updatedAt" | "publishedAt";

export type UnitView = "grid" | "list";
