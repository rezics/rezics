/**
 * Unit-related TypeScript types and interfaces for the frontend
 * 面向前端的 Unit 相关 TypeScript 类型与接口
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
 * 扩展的前端类型
 */
export type UnitFormData = Omit<CreateUnitInput, "userId">;

export type UnitFilters = Omit<Partial<UnitListQuery>, "languages"> & {
  languages?: string | readonly string[];
};

export type UnitSortOption = "createdAt" | "updatedAt" | "publishedAt";

export type UnitView = "grid" | "list";
