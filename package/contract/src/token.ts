import {t} from 'elysia';

export const NormalizedTokenName = {
  AUTH_IDENTITY: 'auth_identity_token',
  REZICS_SESSION: 'rezics_session_token',
  NOTIFICATION_SESSION: 'notification_session_token',
  SEARCH_SESSION: 'search_session_token',
} as const;
export type NormalizedTokenName =
  (typeof NormalizedTokenName)[keyof typeof NormalizedTokenName];

export const normalizedTokenNameSchema = t.Union([
  t.Literal(NormalizedTokenName.AUTH_IDENTITY),
  t.Literal(NormalizedTokenName.REZICS_SESSION),
  t.Literal(NormalizedTokenName.NOTIFICATION_SESSION),
  t.Literal(NormalizedTokenName.SEARCH_SESSION),
]);

export const TokenTransportHeader = {
  AUTHORIZATION: 'Authorization',
  REZICS_SESSION: 'x-rezics_session_token',
  NOTIFICATION_SESSION: 'x-notification_session_token',
  SEARCH_SESSION: 'x-search_session_token',
} as const;
export type TokenTransportHeader =
  (typeof TokenTransportHeader)[keyof typeof TokenTransportHeader];

export const normalizedTokenTransportSchema = t.Object({
  tokenName: normalizedTokenNameSchema,
  headerName: t.String(),
  usesBearer: t.Boolean(),
});
export type NormalizedTokenTransport =
  (typeof normalizedTokenTransportSchema)['static'];

export const tokenPermissionRoleSchema = t.Union([
  t.Literal('ROOT'),
  t.Literal('ADMIN'),
  t.Literal('USER'),
  t.Literal('BLOCKED'),
]);
export type TokenPermissionRole = (typeof tokenPermissionRoleSchema)['static'];

export const sessionPermissionSnapshotSchema = t.Object({
  role: tokenPermissionRoleSchema,
});
export type SessionPermissionSnapshot =
  (typeof sessionPermissionSnapshotSchema)['static'];

export const rezicsSessionTokenClaimsSchema = t.Object({
  unitId: t.String(),
  permission: sessionPermissionSnapshotSchema,
  exp: t.Optional(t.Number()),
  iat: t.Optional(t.Number()),
  iss: t.Optional(t.String()),
  aud: t.Optional(t.Union([t.String(), t.Array(t.String())])),
});
export type RezicsSessionTokenClaims =
  (typeof rezicsSessionTokenClaimsSchema)['static'];

export const authIdentityTokenClaimsSchema = t.Object({
  unitId: t.Optional(t.String()),
  sub: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  scope: t.Optional(t.Union([t.String(), t.Array(t.String())])),
  exp: t.Optional(t.Number()),
  iat: t.Optional(t.Number()),
  iss: t.Optional(t.String()),
  aud: t.Optional(t.Union([t.String(), t.Array(t.String())])),
});
export type AuthIdentityTokenClaims =
  (typeof authIdentityTokenClaimsSchema)['static'];

export const normalizedTokenHeaderMap = {
  [NormalizedTokenName.AUTH_IDENTITY]: TokenTransportHeader.AUTHORIZATION,
  [NormalizedTokenName.REZICS_SESSION]: TokenTransportHeader.REZICS_SESSION,
  [NormalizedTokenName.NOTIFICATION_SESSION]:
    TokenTransportHeader.NOTIFICATION_SESSION,
  [NormalizedTokenName.SEARCH_SESSION]: TokenTransportHeader.SEARCH_SESSION,
} satisfies Record<NormalizedTokenName, TokenTransportHeader>;

export const normalizedTokenTransportMap = {
  [NormalizedTokenName.AUTH_IDENTITY]: {
    tokenName: NormalizedTokenName.AUTH_IDENTITY,
    headerName: TokenTransportHeader.AUTHORIZATION,
    usesBearer: true,
  },
  [NormalizedTokenName.REZICS_SESSION]: {
    tokenName: NormalizedTokenName.REZICS_SESSION,
    headerName: TokenTransportHeader.REZICS_SESSION,
    usesBearer: false,
  },
  [NormalizedTokenName.NOTIFICATION_SESSION]: {
    tokenName: NormalizedTokenName.NOTIFICATION_SESSION,
    headerName: TokenTransportHeader.NOTIFICATION_SESSION,
    usesBearer: false,
  },
  [NormalizedTokenName.SEARCH_SESSION]: {
    tokenName: NormalizedTokenName.SEARCH_SESSION,
    headerName: TokenTransportHeader.SEARCH_SESSION,
    usesBearer: false,
  },
} satisfies Record<NormalizedTokenName, NormalizedTokenTransport>;

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
export type ApiTokenListResponse =
  (typeof apiTokenListResponseSchema)['static'];

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
