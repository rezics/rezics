import {SignJWT, importPKCS8} from 'jose';
import type {AuthContextTokenClaims} from '@package/contract';
import {prisma} from '../auth/prisma';
import {env} from '../env';

const authAudience = env.AUTH_JWT_AUDIENCE ?? 'rezics-api';
const authIssuer = env.AUTH_JWT_ISSUER ?? env.BETTER_AUTH_URL;
const authJwtTtlSeconds = Number(env.AUTH_JWT_TTL_SECONDS ?? '3600');

type AuthUserContext = {
  id: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
  profile?: {
    slug: string;
    avatar?: string | null;
  } | null;
};

async function getSigningKey() {
  const record = await prisma.jwks.findFirst({
    where: {
      OR: [{expiresAt: null}, {expiresAt: {gt: new Date()}}],
    },
    orderBy: [{createdAt: 'desc'}],
  });

  if (!record) {
    throw new Error('Missing auth JWKS signing key');
  }

  return {
    kid: record.id,
    alg: record.alg ?? 'ES256',
    key: await importPKCS8(record.privateKey, 'ES256'),
  };
}

/**
 * Map an auth user record to the standardized context-token claim set.
 * Falls back to `user.image` when no profile avatar is set, and uses
 * the user ID as the slug when no profile slug exists.
 */
export function buildAuthContextClaims(
  user: AuthUserContext,
): AuthContextTokenClaims {
  const avatar = user.profile?.avatar ?? user.image ?? null;

  return {
    id: user.id,
    sub: user.id,
    unitId: user.id,
    slug: user.profile?.slug ?? user.id,
    name: user.name,
    avatar,
    emailVerified: user.emailVerified,
    verificationStatus: user.emailVerified ? 'verified' : 'pending',
    scope: 'user',
  };
}

/**
 * Build and sign an ES256 auth-context JWT for the given user.
 * Fetches the latest JWKS signing key from the database, constructs
 * the claims via {@link buildAuthContextClaims}, and returns both the
 * signed token string and the embedded claims.
 */
export async function signAuthContextToken(
  user: AuthUserContext,
): Promise<{token: string; claims: AuthContextTokenClaims}> {
  const claims = buildAuthContextClaims(user);
  const signingKey = await getSigningKey();

  const token = await new SignJWT(claims)
    .setProtectedHeader({
      alg: signingKey.alg,
      kid: signingKey.kid,
    })
    .setIssuer(authIssuer)
    .setAudience(authAudience)
    .setIssuedAt()
    .setSubject(user.id)
    .setExpirationTime(`${authJwtTtlSeconds}s`)
    .sign(signingKey.key);

  return {
    token,
    claims,
  };
}
