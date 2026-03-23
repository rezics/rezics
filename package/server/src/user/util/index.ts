import {
  NormalizedTokenName,
  type AuthContextTokenClaims,
  type NormalizedTokenName as NormalizedTokenNameType,
} from '@package/contract';
import {
  JwtAlgorithm,
  verifyTokenFromHeader,
  type JwtVerifyInput as VerifyOptions,
  type VerifiedJwt as VerifiedToken,
} from '@package/jwt';
import type {JWTPayload} from 'jose';
import {env} from '../../env';
import {getJwtService} from '@/src/jwt';

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
  const trustedAuth = await getJwtService('auth-upstream');
  return buildTrustedAuthVerifyOptions(trustedAuth, overrides, tokenName);
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
