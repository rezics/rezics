import {
  NormalizedTokenName,
  type AuthContextTokenClaims,
  type AuthIdentityTokenClaims,
  type NormalizedTokenName as NormalizedTokenNameType,
} from '@package/contract';
import {
  JwtAlgorithm,
  verifyBearerToken,
  verifySessionToken,
  verifyTokenFromHeader,
  type JwtVerifyInput as VerifyOptions,
  type VerifiedJwt as VerifiedToken,
} from '@package/jwt';
import type {JWTPayload} from 'jose';
import {env} from '../../env';
import {getTrustedAuthJwtServiceRecord} from '@/src/session';

export function buildTrustedAuthVerifyOptions(
  trustedAuth: {
    issuer: string;
    audience: string;
    jwksUrl: string;
  },
  overrides?: Partial<VerifyOptions>,
  tokenName: NormalizedTokenNameType = NormalizedTokenName.AUTH_IDENTITY,
): VerifyOptions {
  return {
    issuer: overrides?.issuer ?? trustedAuth.issuer,
    audience: overrides?.audience ?? trustedAuth.audience,
    jwksUrl:
      typeof overrides?.jwksUrl === 'string'
        ? overrides.jwksUrl
        : trustedAuth.jwksUrl,
    algorithm: overrides?.algorithm ?? JwtAlgorithm.ES256,
    tokenName,
    clockToleranceSeconds:
      overrides?.clockToleranceSeconds ??
      Number(env.AUTH_JWT_CLOCK_TOLERANCE_SECONDS ?? '5'),
    requiredScope: overrides?.requiredScope ?? 'user',
    enforceTransport: overrides?.enforceTransport ?? true,
  };
}

async function buildAuthVerifyOptions(
  overrides?: Partial<VerifyOptions>,
  tokenName: NormalizedTokenNameType = NormalizedTokenName.AUTH_IDENTITY,
): Promise<VerifyOptions> {
  const trustedAuth = await getTrustedAuthJwtServiceRecord();
  return buildTrustedAuthVerifyOptions(trustedAuth, overrides, tokenName);
}

export async function getServerAuthIdentityVerifyOptions(
  overrides?: Partial<VerifyOptions>,
): Promise<VerifyOptions> {
  return buildAuthVerifyOptions(overrides, NormalizedTokenName.AUTH_IDENTITY);
}

export async function getServerAuthContextVerifyOptions(
  overrides?: Partial<VerifyOptions>,
): Promise<VerifyOptions> {
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
    await getServerAuthIdentityVerifyOptions(overrides),
  );
}

export async function verifyAuthContextToken<
  TPayload extends JWTPayload = AuthContextTokenClaims & JWTPayload,
>(
  token: string | undefined,
  overrides?: Partial<VerifyOptions>,
): Promise<VerifiedToken<TPayload>> {
  return verifyTokenFromHeader<TPayload>(
    token,
    await getServerAuthContextVerifyOptions(overrides),
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
  verifyTokenFromHeader as verifyToken,
};
export type {VerifiedToken, VerifyOptions};
