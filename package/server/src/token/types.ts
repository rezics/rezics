import type { ApiTokenDTO, ApiTokenScopes } from "@rezics/contract";
import type { ApiToken } from "../db/schema";

/**
 * Internal representation of an API token row with normalized scopes.
 */
export type ApiTokenWithScopes = typeof ApiToken.$inferSelect & {
  scopes: ApiTokenScopes | null;
};

/**
 * Map an ApiToken row to a DTO returned to clients.
 */
export function mapApiTokenToDTO(token: ApiTokenWithScopes): ApiTokenDTO {
  return {
    id: token.id,
    name: token.name,
    userId: token.userId,
    scopes: (token.scopes ?? undefined) as ApiTokenScopes | undefined,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt ?? null,
    lastUsedAt: token.lastUsedAt ?? null,
    lastIP: token.lastIP ?? null,
    userAgent: token.userAgent ?? null,
    revoked: token.revoked,
    revokedAt: token.revokedAt ?? null,
  };
}
