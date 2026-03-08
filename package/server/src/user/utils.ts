import type {JWTPayload, RefreshTokenPayload} from '@/src/user/types';
import {verifyBearerToken} from '@package/auth/jwt';
import {env} from '@/src/env';

type CommonPayload = JWTPayload | RefreshTokenPayload;

/**
 * Helper function to extract and verify JWT from Authorization header
 * */
export async function verifyAuth<T extends CommonPayload>(
  authorization: string | undefined,
  setOrJwtInstance: any,
  maybeSet?: any,
): Promise<T> {
  const set = maybeSet ?? setOrJwtInstance;
  try {
    const verified = await verifyBearerToken(authorization, {
      jwksUrl:
        env.AUTH_JWKS_URL ??
        `${(env.AUTH_JWT_ISSUER ?? 'http://localhost:35003').replace(/\/$/, '')}/.well-known/jwks.json`,
      issuer: env.AUTH_JWT_ISSUER ?? 'http://localhost:35003',
      audience: env.AUTH_JWT_AUDIENCE ?? 'rezics-api',
      clockTolerance: Number(env.AUTH_JWT_CLOCK_TOLERANCE_SECONDS ?? '5'),
    });

    return verified.payload as T;
  } catch {
    set.status = 401;
    throw new Error('Unauthorized: Invalid token');
  }
}
