import { t } from "elysia";

/**
 * <issuer>-<token-type>
 *
 * @example
 * rezics-session-token — issued by server, used as Bearer access token
 */

export const NormalizedTokenName = {
  /**
   * rezics-session-token — issued by server, used as Bearer access token for rezics server
   */
  REZICS_SESSION: "rezics-session-token",
  /**
   * rezics-profile-setup-token — issued by server for profile setup routes only
   */
  REZICS_PROFILE_SETUP: "rezics-profile-setup-token",
} as const;
export type NormalizedTokenName =
  (typeof NormalizedTokenName)[keyof typeof NormalizedTokenName];

export const normalizedTokenNameSchema = t.Union([
  t.Literal(NormalizedTokenName.REZICS_SESSION),
  t.Literal(NormalizedTokenName.REZICS_PROFILE_SETUP),
]);

export const TokenTransportHeader = {
  AUTHORIZATION: "Authorization",
} as const;
export type TokenTransportHeader =
  (typeof TokenTransportHeader)[keyof typeof TokenTransportHeader];

export const normalizedTokenTransportSchema = t.Object({
  tokenName: normalizedTokenNameSchema,
  headerName: t.String(),
  usesBearer: t.Boolean(),
});
export type NormalizedTokenTransport =
  (typeof normalizedTokenTransportSchema)["static"];

/**
 * Main Server Token Permission Role
 */
export const tokenPermissionRoleSchema = t.Union([
  t.Literal("ROOT"),
  t.Literal("ADMIN"),
  t.Literal("USER"),
  t.Literal("MEMBER"),
  t.Literal("BLOCKED"),
]);
export type TokenPermissionRole = (typeof tokenPermissionRoleSchema)["static"];

export const rezicsSessionClaimsSchema = t.Object({
  tokenType: t.Literal("member-session"),
  sub: t.String(),
  userId: t.String(),
  permission: t.Object({
    role: tokenPermissionRoleSchema,
  }),
  iss: t.Literal("rezics-server"),
  exp: t.Number(),
  iat: t.Number(),
});
export type RezicsSessionClaims = (typeof rezicsSessionClaimsSchema)["static"];

export const rezicsProfileSetupClaimsSchema = t.Object({
  tokenType: t.Literal("profile-setup"),
  purpose: t.Literal("profile-setup"),
  sub: t.String(),
  userId: t.String(),
  iss: t.Literal("rezics-server"),
  exp: t.Number(),
  iat: t.Number(),
});
export type RezicsProfileSetupClaims =
  (typeof rezicsProfileSetupClaimsSchema)["static"];

export const normalizedTokenHeaderMap = {
  [NormalizedTokenName.REZICS_SESSION]: TokenTransportHeader.AUTHORIZATION,
  [NormalizedTokenName.REZICS_PROFILE_SETUP]:
    TokenTransportHeader.AUTHORIZATION,
} satisfies Record<NormalizedTokenName, TokenTransportHeader>;

export const TokenContextKey = {
  REZICS_SESSION: "rezicsSessionToken",
  REZICS_PROFILE_SETUP: "rezicsProfileSetupToken",
} as const;
export type TokenContextKey =
  (typeof TokenContextKey)[keyof typeof TokenContextKey];

export const normalizedTokenTransportMap = {
  [NormalizedTokenName.REZICS_SESSION]: {
    tokenName: NormalizedTokenName.REZICS_SESSION,
    headerName: TokenTransportHeader.AUTHORIZATION,
    usesBearer: true,
  },
  [NormalizedTokenName.REZICS_PROFILE_SETUP]: {
    tokenName: NormalizedTokenName.REZICS_PROFILE_SETUP,
    headerName: TokenTransportHeader.AUTHORIZATION,
    usesBearer: true,
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
export type ApiTokenScopes = (typeof apiTokenScopesSchema)["static"];

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
export type ApiTokenDTO = (typeof apiTokenDTOSchema)["static"];

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
export type CreateApiTokenInput = (typeof createApiTokenSchema)["static"];

/**
 * Request body for updating an existing API token's metadata.
 * Only mutable fields (name, scopes, expiresAt) are exposed here.
 */
export const updateApiTokenSchema = t.Object({
  name: t.Optional(t.String()),
  scopes: t.Optional(apiTokenScopesSchema),
  expiresAt: t.Optional(t.Union([t.String(), t.Null()])),
});
export type UpdateApiTokenInput = (typeof updateApiTokenSchema)["static"];

/**
 * Response shape for listing tokens of the current user.
 */
export const apiTokenListResponseSchema = t.Object({
  tokens: t.Array(apiTokenDTOSchema),
});
export type ApiTokenListResponse =
  (typeof apiTokenListResponseSchema)["static"];

/**
 * Response shape for creating a token.
 * `token` is the raw secret; it is only returned once and must be stored by the client.
 */
export const createApiTokenResponseSchema = t.Object({
  token: t.String(),
  tokenInfo: apiTokenDTOSchema,
});
export type CreateApiTokenResponse =
  (typeof createApiTokenResponseSchema)["static"];
