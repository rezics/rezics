import {
  NormalizedTokenName,
  type AuthContextTokenClaims,
  type AuthIdentityTokenClaims,
  type NormalizedTokenName as NormalizedTokenNameType,
} from '@package/contract';
import {
  verifyBearerToken,
  verifySessionToken,
  verifyToken,
  type VerifiedToken,
  type VerifyOptions,
} from '@package/auth/jwt';
import type {JWTPayload} from 'jose';
import {env} from '@/src/env';

function buildAuthVerifyOptions(
  overrides?: Partial<VerifyOptions>,
  tokenName: NormalizedTokenNameType = NormalizedTokenName.AUTH_IDENTITY,
): VerifyOptions {
  const issuer = overrides?.issuer ?? env.AUTH_JWT_ISSUER ?? 'http://localhost:35003';
  const audience = overrides?.audience ?? env.AUTH_JWT_AUDIENCE ?? 'rezics-api';
  const jwksUrl =
    typeof overrides?.jwksUrl === 'string'
      ? overrides.jwksUrl
      : env.AUTH_JWKS_URL ?? new URL('/api/auth/jwks', issuer).toString();

  return {
    issuer,
    audience,
    jwksUrl,
    tokenName,
    clockTolerance:
      overrides?.clockTolerance ??
      Number(env.AUTH_JWT_CLOCK_TOLERANCE_SECONDS ?? '5'),
    requiredScope: overrides?.requiredScope ?? 'user',
    enforceTransport: overrides?.enforceTransport ?? true,
  };
}

export function getServerAuthIdentityVerifyOptions(
  overrides?: Partial<VerifyOptions>,
): VerifyOptions {
  return buildAuthVerifyOptions(overrides, NormalizedTokenName.AUTH_IDENTITY);
}

export function getServerAuthContextVerifyOptions(
  overrides?: Partial<VerifyOptions>,
): VerifyOptions {
  return buildAuthVerifyOptions(
    {
      ...overrides,
      requiredScope: overrides?.requiredScope ?? undefined,
    },
    NormalizedTokenName.AUTH_CONTEXT,
  );
}

export async function verifyAuthIdentityToken<
  TPayload extends JWTPayload = AuthIdentityTokenClaims & JWTPayload,
>(
  authorization: string | undefined,
  overrides?: Partial<VerifyOptions>,
): Promise<VerifiedToken<TPayload>> {
  return verifyBearerToken<TPayload>(
    authorization,
    getServerAuthIdentityVerifyOptions(overrides),
  );
}

export async function verifyAuthContextToken<
  TPayload extends JWTPayload = AuthContextTokenClaims & JWTPayload,
>(
  token: string | undefined,
  overrides?: Partial<VerifyOptions>,
): Promise<VerifiedToken<TPayload>> {
  return verifyToken<TPayload>(
    token,
    getServerAuthContextVerifyOptions(overrides),
  );
}

function isVerifyOptions(value: unknown): value is Partial<VerifyOptions> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    'issuer' in record ||
    'audience' in record ||
    'jwksUrl' in record ||
    'verificationKey' in record ||
    'verificationKeyPem' in record ||
    'tokenName' in record
  );
}

function isSetLike(value: unknown): value is {status?: number} {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'status' in (value as Record<string, unknown>),
  );
}

export async function verifyAuth<
  TPayload extends JWTPayload = AuthIdentityTokenClaims & JWTPayload,
>(
  authorization: string | undefined,
  jwtOrSetOrOptions?: unknown,
  setOrOptions?: unknown,
  maybeOptions?: Partial<VerifyOptions>,
): Promise<TPayload> {
  let set: {status?: number} | undefined;
  let explicitOptions: Partial<VerifyOptions> | undefined;

  if (isVerifyOptions(jwtOrSetOrOptions)) {
    explicitOptions = jwtOrSetOrOptions;
  } else if (isSetLike(jwtOrSetOrOptions)) {
    set = jwtOrSetOrOptions;
  }

  if (isSetLike(setOrOptions)) {
    set = setOrOptions;
  } else if (isVerifyOptions(setOrOptions)) {
    explicitOptions = setOrOptions;
  }

  if (maybeOptions) {
    explicitOptions = maybeOptions;
  }

  try {
    const verified = await verifyAuthIdentityToken<TPayload>(
      authorization,
      explicitOptions,
    );
    return verified.payload;
  } catch (error) {
    if (set) {
      set.status = 401;
    }
    throw error;
  }
}

export {
  verifyBearerToken,
  verifySessionToken,
  verifyToken,
};
export type {VerifiedToken, VerifyOptions};
