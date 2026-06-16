import { t } from "elysia";

/**
 * <issuer>-<token-type>
 * <issuer>-<token-type>（签发方-令牌类型）。
 *
 * @example
 * rezics-session-token — issued by server, used as Bearer access token。由 server 签发，用作 Bearer 访问令牌。
 */

export const NormalizedTokenName = {
  /**
   * rezics-session-token — issued by server, used as Bearer access token for rezics server
   * rezics-session-token — 由 server 签发，用作 rezics server 的 Bearer 访问令牌。
   */
  // TODO(openspec-retired): rezics-session-token is intended as the sole browser
  // credential; verify the auth service no longer issues x-auth-session-token for
  // browser flows, and that no external token-wallet boundary is needed here.
  // rezics-session-token 预期作为唯一的浏览器凭证；需确认 auth 服务不再为浏览器流程
  // 签发 x-auth-session-token，且此处不需要外部 token-wallet 边界。
  REZICS_SESSION: "rezics-session-token",
  /**
   * rezics-profile-setup-token — issued by server for profile setup routes only
   * rezics-profile-setup-token — 由 server 签发，仅用于资料设置路由。
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
 * 主 Server 令牌的权限角色。
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
 * API token 的 scopes 建模为一个简单的 JSON 对象：
 * - 顶层键表示逻辑域（例如 "book"）。
 * - 值是字符串权限数组（例如 ["read", "write", "delete"]）。
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
 * 列出或查看 API token 时暴露给客户端的 DTO。
 * 此处绝不包含原始 token secret。
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
 * 创建新 API token 的请求体。
 * server 会生成实际的 token 字符串并仅返回一次。
 */
export const createApiTokenSchema = t.Object({
  name: t.String(),
  scopes: t.Optional(apiTokenScopesSchema),
  /**
   * Optional expiration time in ISO 8601 format.
   * If omitted, the token does not expire automatically.
   * 可选的过期时间，采用 ISO 8601 格式。
   * 若省略，token 不会自动过期。
   */
  expiresAt: t.Optional(t.String()),
});
export type CreateApiTokenInput = (typeof createApiTokenSchema)["static"];

/**
 * Request body for updating an existing API token's metadata.
 * Only mutable fields (name, scopes, expiresAt) are exposed here.
 * 更新现有 API token 元数据的请求体。
 * 此处仅暴露可变字段（name、scopes、expiresAt）。
 */
export const updateApiTokenSchema = t.Object({
  name: t.Optional(t.String()),
  scopes: t.Optional(apiTokenScopesSchema),
  expiresAt: t.Optional(t.Union([t.String(), t.Null()])),
});
export type UpdateApiTokenInput = (typeof updateApiTokenSchema)["static"];

/**
 * Response shape for listing tokens of the current user.
 * 列出当前用户 token 的响应结构。
 */
export const apiTokenListResponseSchema = t.Object({
  tokens: t.Array(apiTokenDTOSchema),
});
export type ApiTokenListResponse =
  (typeof apiTokenListResponseSchema)["static"];

/**
 * Response shape for creating a token.
 * `token` is the raw secret; it is only returned once and must be stored by the client.
 * 创建 token 的响应结构。
 * `token` 是原始 secret；仅返回一次，必须由客户端自行存储。
 */
export const createApiTokenResponseSchema = t.Object({
  token: t.String(),
  tokenInfo: apiTokenDTOSchema,
});
export type CreateApiTokenResponse =
  (typeof createApiTokenResponseSchema)["static"];
