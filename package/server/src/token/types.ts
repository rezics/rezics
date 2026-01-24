import type {ApiToken} from '@/prisma/client';
import type {ApiTokenDTO, ApiTokenScopes} from '@package/contract';

/**
 * Internal representation of an API token row with normalized scopes.
 */
export type ApiTokenWithScopes = ApiToken & {
  scopes: ApiTokenScopes | null;
};

/**
 * Map a Prisma ApiToken record to a DTO returned to clients.
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
