import {t} from 'elysia';

/**
 * API token scopes are modeled as a simple JSON object:
 * - top-level keys represent logical domains (e.g. "book")
 * - values are arrays of string permissions (e.g. ["read", "write", "delete"])
 *
 * Example:
 * {
 *   "book": ["read", "write"],
 *   "user": ["read"]
 * }
 */
export const apiTokenScopesSchema = t.Record(t.String(), t.Array(t.String()));
export type ApiTokenScopes = (typeof apiTokenScopesSchema)['static'];

/**
 * DTO exposed to clients when listing or inspecting API tokens.
 * The raw token secret is NEVER included here.
 */
export const apiTokenDTOSchema = t.Object({
  id: t.String(),
  name: t.String(),
  userId: t.String(),
  scopes: t.Optional(apiTokenScopesSchema),
  createdAt: t.Union([t.String(), t.Date()]),
  expiresAt: t.Optional(t.Union([t.String(), t.Date(), t.Null()])),
  lastUsedAt: t.Optional(t.Union([t.String(), t.Date(), t.Null()])),
  lastIP: t.Optional(t.Union([t.String(), t.Null()])),
  userAgent: t.Optional(t.Union([t.String(), t.Null()])),
  revoked: t.Optional(t.Boolean()),
  revokedAt: t.Optional(t.Union([t.String(), t.Date(), t.Null()])),
});
export type ApiTokenDTO = (typeof apiTokenDTOSchema)['static'];

/**
 * Request body for creating a new API token.
 * The server will generate the actual token string and return it once.
 */
export const createApiTokenSchema = t.Object({
  name: t.String(),
  scopes: t.Optional(apiTokenScopesSchema),
  /**
   * Optional expiration time in ISO 8601 format.
   * If omitted, the token does not expire automatically.
   */
  expiresAt: t.Optional(t.String()),
});
export type CreateApiTokenInput = (typeof createApiTokenSchema)['static'];

/**
 * Request body for updating an existing API token's metadata.
 * Only mutable fields (name, scopes, expiresAt) are exposed here.
 */
export const updateApiTokenSchema = t.Object({
  name: t.Optional(t.String()),
  scopes: t.Optional(apiTokenScopesSchema),
  expiresAt: t.Optional(t.Union([t.String(), t.Null()])),
});
export type UpdateApiTokenInput = (typeof updateApiTokenSchema)['static'];

/**
 * Response shape for listing tokens of the current user.
 */
export const apiTokenListResponseSchema = t.Object({
  tokens: t.Array(apiTokenDTOSchema),
});
export type ApiTokenListResponse = (typeof apiTokenListResponseSchema)['static'];

/**
 * Response shape for creating a token.
 * `token` is the raw secret; it is only returned once and must be stored by the client.
 */
export const createApiTokenResponseSchema = t.Object({
  token: t.String(),
  tokenInfo: apiTokenDTOSchema,
});
export type CreateApiTokenResponse =
  (typeof createApiTokenResponseSchema)['static'];


