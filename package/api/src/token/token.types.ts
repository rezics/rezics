/**
 * Token-related TypeScript types for the frontend.
 * Raw DTO & input types come from `@rezics/contract`.
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
export type {
  ApiTokenDTO,
  ApiTokenListResponse,
  ApiTokenScopes,
  CreateApiTokenInput,
  CreateApiTokenResponse,
  UpdateApiTokenInput,
};
