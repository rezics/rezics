import type {JWTPayload} from 'jose';
import {
  type AuthContextTokenClaims,
  type AuthIdentityTokenClaims,
  NormalizedTokenName,
} from '@package/contract';
import {env} from '../env';
import {
  verifyBearerToken,
  verifyToken,
  type VerifiedToken,
  type VerifyOptions,
} from './verify';

// ---------------------------------------------------------------------------
// Option builders — inject auth-service env defaults
// ---------------------------------------------------------------------------

/**
 * Build VerifyOptions for auth-service-local use, filling gaps from env.
 */
function buildLocalDefaults(
  overrides?: Partial<VerifyOptions>,
  tokenName: VerifyOptions['tokenName'] = NormalizedTokenName.AUTH_IDENTITY,
): VerifyOptions {
  const issuer =
    overrides?.issuer ?? env.AUTH_JWT_ISSUER ?? env.BETTER_AUTH_URL;
  const audience = overrides?.audience ?? env.AUTH_JWT_AUDIENCE ?? 'rezics-api';
  const jwksUrl =
    typeof overrides?.jwksUrl === 'string'
      ? overrides.jwksUrl
      : new URL('/api/auth/jwks', issuer).toString();

  return {
    issuer,
    audience,
    jwksUrl,
    tokenName,
    clockTolerance: overrides?.clockTolerance ?? 5,
    requiredScope: overrides?.requiredScope ?? undefined,
    enforceTransport: overrides?.enforceTransport ?? true,
  };
}

/**
 * Build VerifyOptions pre-filled for AUTH_IDENTITY tokens using local env.
 */
export function getAuthIdentityVerifyOptions(
  overrides?: Partial<VerifyOptions>,
): VerifyOptions {
  return buildLocalDefaults(overrides, NormalizedTokenName.AUTH_IDENTITY);
}

/**
 * Build VerifyOptions pre-filled for AUTH_CONTEXT tokens using local env.
 * Scope enforcement is disabled by default for context tokens.
 */
export function getAuthContextVerifyOptions(
  overrides?: Partial<VerifyOptions>,
): VerifyOptions {
  return buildLocalDefaults(
    {...overrides, requiredScope: overrides?.requiredScope ?? undefined},
    NormalizedTokenName.AUTH_CONTEXT,
  );
}

// ---------------------------------------------------------------------------
// Local verification wrappers
// ---------------------------------------------------------------------------

/**
 * Verify an auth identity token using auth-service env defaults.
 */
export async function verifyAuthIdentityToken<
  TPayload extends JWTPayload = AuthIdentityTokenClaims & JWTPayload,
>(
  authorization: string | undefined,
  overrides?: Partial<VerifyOptions>,
): Promise<VerifiedToken<TPayload>> {
  return verifyBearerToken<TPayload>(
    authorization,
    getAuthIdentityVerifyOptions(overrides),
  );
}

/**
 * Verify an auth context token using auth-service env defaults.
 */
export async function verifyAuthContextToken<
  TPayload extends JWTPayload = AuthContextTokenClaims & JWTPayload,
>(
  token: string | undefined,
  overrides?: Partial<VerifyOptions>,
): Promise<VerifiedToken<TPayload>> {
  return verifyToken<TPayload>(token, getAuthContextVerifyOptions(overrides));
}

/**
 * Convenience wrapper: verify an auth identity Bearer token and return only
 * the payload. Optionally sets `set.status = 401` on failure when a
 * response-set object is provided.
 *
 * Accepts a flexible argument list for ergonomic use in Elysia handlers:
 *   verifyAuth(authorization)
 *   verifyAuth(authorization, set)
 *   verifyAuth(authorization, options)
 *   verifyAuth(authorization, set, options)
 */
export async function verifyAuth<
  TPayload extends JWTPayload = AuthIdentityTokenClaims & JWTPayload,
>(
  authorization: string | undefined,
  setOrOptions?: {status?: number} | Partial<VerifyOptions>,
  maybeOptions?: Partial<VerifyOptions>,
): Promise<TPayload> {
  let set: {status?: number} | undefined;
  let options: Partial<VerifyOptions> | undefined;

  if (isResponseSet(setOrOptions)) {
    set = setOrOptions;
    options = maybeOptions;
  } else if (setOrOptions) {
    options = setOrOptions as Partial<VerifyOptions>;
  }

  try {
    const verified = await verifyAuthIdentityToken<TPayload>(
      authorization,
      options,
    );
    return verified.payload;
  } catch (error) {
    if (set) set.status = 401;
    throw error;
  }
}

function isResponseSet(value: unknown): value is {status?: number} {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    'status' in (value as Record<string, unknown>)
  );
}
