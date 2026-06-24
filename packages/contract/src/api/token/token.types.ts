/**
 * Token-related TypeScript types for the frontend.
 * Raw DTO & input types come from `@rezics/contract`.
 * 前端使用的 token 相关 TypeScript 类型。
 * 原始 DTO 与输入类型来自 `@rezics/contract`。
 */

import type {
  ApiTokenDTO,
  ApiTokenListResponse,
  ApiTokenScopes,
  CreateApiTokenInput,
  CreateApiTokenResponse,
  UpdateApiTokenInput,
} from "@rezics/contract";

// Re-export contract types for convenience
// 为方便起见重新导出契约类型
export type {
  ApiTokenDTO,
  ApiTokenListResponse,
  ApiTokenScopes,
  CreateApiTokenInput,
  CreateApiTokenResponse,
  UpdateApiTokenInput,
};
