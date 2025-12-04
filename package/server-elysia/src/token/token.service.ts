import {prisma} from '@/prisma/client';
import type {Prisma} from '@/prisma/client';
import {
  type ApiTokenDTO,
  type ApiTokenScopes,
  type CreateApiTokenInput,
  type UpdateApiTokenInput,
} from '@package/contract';
import {generateSecureToken, hashToken, verifyTokenHash} from './utils';
import {mapApiTokenToDTO, type ApiTokenWithScopes} from './types';

/**
 * API Token Service
 *
 * Responsible for:
 * - Managing API tokens for users (create/list/update/revoke)
 * - Authenticating incoming API tokens from the Authorization header
 * - Enforcing simple scope-based access control
 */
export class TokenService {
  /**
   * Generate and persist a new API token for the given user.
   * Returns the raw token string (to be shown once) and its DTO.
   */
  async createToken(
    userId: string,
    input: CreateApiTokenInput,
    opts?: {ip?: string | null; userAgent?: string | null},
  ): Promise<{token: string; tokenInfo: ApiTokenDTO}> {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);

    const created = await prisma.apiToken.create({
      data: {
        userId,
        name: input.name,
        tokenHash,
        scopes:
          input.scopes != null
            ? (input.scopes as Prisma.InputJsonValue)
            : undefined,
        expiresAt:
          input.expiresAt && input.expiresAt !== ''
            ? new Date(input.expiresAt)
            : undefined,
        lastIP: opts?.ip ?? undefined,
        userAgent: opts?.userAgent ?? undefined,
      },
    });

    const tokenInfo = mapApiTokenToDTO(
      created as ApiTokenWithScopes,
    ) as ApiTokenDTO;

    return {token: rawToken, tokenInfo};
  }

  /**
   * List all non-revoked tokens for a user.
   */
  async listTokens(userId: string): Promise<ApiTokenDTO[]> {
    const tokens = await prisma.apiToken.findMany({
      where: {
        userId,
        revoked: false,
      },
      orderBy: {createdAt: 'desc'},
    });
    return tokens.map(t => mapApiTokenToDTO(t as ApiTokenWithScopes));
  }

  /**
   * Update basic metadata of a token.
   * Only the owner of the token is allowed to update it.
   */
  async updateToken(
    userId: string,
    id: string,
    input: UpdateApiTokenInput,
  ): Promise<ApiTokenDTO> {
    const existing = await prisma.apiToken.findUnique({
      where: {id},
    });
    if (!existing || existing.userId !== userId) {
      throw new Error('Token not found or you do not own this token');
    }

    const updated = await prisma.apiToken.update({
      where: {id},
      data: {
        name: input.name ?? existing.name,
        scopes:
          input.scopes != null
            ? (input.scopes as Prisma.InputJsonValue)
            : (existing.scopes as Prisma.InputJsonValue | undefined) ??
              undefined,
        expiresAt:
          input.expiresAt === null
            ? undefined
            : input.expiresAt
            ? new Date(input.expiresAt)
            : existing.expiresAt ?? undefined,
      },
    });

    return mapApiTokenToDTO(updated as ApiTokenWithScopes);
  }

  /**
   * Soft-revoke a token so it can no longer be used.
   */
  async revokeToken(userId: string, id: string): Promise<void> {
    const existing = await prisma.apiToken.findUnique({
      where: {id},
    });
    if (!existing || existing.userId !== userId) {
      throw new Error('Token not found or you do not own this token');
    }

    if (existing.revoked) return;

    await prisma.apiToken.update({
      where: {id},
      data: {revoked: true, revokedAt: new Date()},
    });
  }

  /**
   * Extract the raw API token value from an Authorization header.
   * Accepts either:
   * - "Bearer api_xxx"
   * - "api_xxx"
   */
  extractRawToken(authorization: string | undefined): string | null {
    if (!authorization || typeof authorization !== 'string') return null;

    if (authorization.startsWith('Bearer ')) {
      return authorization.slice('Bearer '.length);
    }

    return authorization;
  }

  /**
   * Authenticate a request using an API token from the Authorization header.
   * Throws on failure; otherwise returns the token owner and scopes.
   */
  async authenticateFromHeader(
    authorization: string | undefined,
    set: {status?: number},
    opts?: {ip?: string | null; userAgent?: string | null},
  ): Promise<{userId: string; token: ApiTokenDTO; scopes: ApiTokenScopes}> {
    const rawToken = this.extractRawToken(authorization);
    if (!rawToken) {
      set.status = 401;
      throw new Error('Unauthorized: Missing API token');
    }

    // We hash the raw token value and look it up by hash.
    const hashed = hashToken(rawToken);
    const record = await prisma.apiToken.findUnique({
      where: {tokenHash: hashed},
    });

    if (!record) {
      set.status = 401;
      throw new Error('Unauthorized: Invalid API token');
    }

    // Double-check hash using timingSafeEqual to avoid subtle timing attacks.
    if (!verifyTokenHash(rawToken, record.tokenHash)) {
      set.status = 401;
      throw new Error('Unauthorized: Invalid API token');
    }

    // Check revoked / expiry
    if (record.revoked) {
      set.status = 401;
      throw new Error('Unauthorized: API token has been revoked');
    }
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      set.status = 401;
      throw new Error('Unauthorized: API token has expired');
    }

    // Update usage metadata in the background (non-blocking best-effort).
    // We may need this later, but now disabled for performance reasons.
    // void prisma.apiToken
    //   .update({
    //     where: {id: record.id},
    //     data: {
    //       lastUsedAt: new Date(),
    //       lastIP: opts?.ip ?? undefined,
    //       userAgent: opts?.userAgent ?? undefined,
    //     },
    //   })
    //   .catch(() => {});
    // const tokenDto = mapApiTokenToDTO(record as ApiTokenWithScopes);

    const scopes =
      (record.scopes as ApiTokenScopes | null) ?? ({} as ApiTokenScopes);

    return {
      userId: record.userId,
      token: null as any,
      scopes,
    };
  }

  /**
   * Check whether a scope map grants the given permission.
   *
   * Example:
   *  hasScope(scopes, 'book', 'read')
   */
  hasScope(
    scopes: ApiTokenScopes | null | undefined,
    domain: string,
    permission: string,
  ): boolean {
    if (!scopes) return false;
    const domainPerms = scopes[domain];
    if (!Array.isArray(domainPerms)) return false;
    return domainPerms.includes(permission) || domainPerms.includes('*');
  }

  hasAdminScope(scopes: ApiTokenScopes | null | undefined): boolean {
    return scopes?.main?.includes('admin') ?? false;
  }
}

export const tokenService = new TokenService();
