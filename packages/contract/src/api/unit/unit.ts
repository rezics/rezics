/**
 * Unit API - Main entry point
 * Provides a unified interface for all unit-related operations
 *
 * File organization:
 * - unit.types.ts: TypeScript types and interfaces
 * - unit.keys.ts: React Query key factory
 * - unit.api.ts: API client functions
 * - unit.queries.ts: Query configurations
 * - unit.mutations.ts: Mutation hooks
 * - unit.ts: Main entry (this file) - unified exports
 *
 * Unit API —— 主入口。
 * 为所有 unit 相关操作提供统一接口。
 *
 * 文件组织：
 * - unit.types.ts：TypeScript 类型与接口
 * - unit.keys.ts：React Query 键工厂
 * - unit.api.ts：API 客户端函数
 * - unit.queries.ts：查询配置
 * - unit.mutations.ts：变更 hooks
 * - unit.ts：主入口（本文件）—— 统一导出
 */

export { unitAuthorityApi } from "./authority.api";
// Query Keys
// 查询键
export { unitAuthorityKeys } from "./authority.keys";
// Mutation Hooks
// 变更 hooks
export {
  type RemoveUnitCollaboratorVariables,
  type RemoveUnitFieldLockVariables,
  type UpsertUnitCollaboratorVariables,
  type UpsertUnitFieldLockVariables,
  unitAuthorityMutations,
  useRemoveUnitCollaboratorMutation,
  useRemoveUnitFieldLockMutation,
  useUpsertUnitCollaboratorMutation,
  useUpsertUnitFieldLockMutation,
} from "./authority.mutations";
// Query Configurations
// 查询配置
export {
  unitAuthorityQueries,
  unitCollaboratorsQueryOptions,
  unitFieldLocksQueryOptions,
} from "./authority.queries";
// API Client
// API 客户端
export { unitApi } from "./unit.api";
export { unitKeys } from "./unit.keys";
export {
  unitMutations,
  useCreateUnitMutation,
  useDeleteTranslationMutation,
  useDeleteUnitMutation,
  useUpdateUnitMutation,
  useUpsertTranslationMutation,
} from "./unit.mutations";
export {
  unitBySlugQuery,
  unitDetailQuery,
  unitInfiniteListQuery,
  unitListQuery,
  unitQueries,
  unitSearchQuery,
  unitsByUserQuery,
} from "./unit.queries";
// Types
// 类型
export type {
  CreateUnitInput,
  UnitDTO,
  UnitFilters,
  UnitFormData,
  UnitListQuery,
  UnitListResponse,
  UnitResponse,
  UnitSortOption,
  UnitTranslationDTO,
  UnitView,
  UpdateUnitInput,
} from "./unit.types";
