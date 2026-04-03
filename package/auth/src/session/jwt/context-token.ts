import {SignJWT} from 'jose';
import type {AuthContextTokenClaims} from '@rezics/contract';
import {getAuthPrivateSigningKey} from './service';
import {
  getAuthJwtAudience,
  getAuthJwtIssuer,
  getAuthJwtTtlSeconds,
} from './options';

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

export async function signAuthContextToken(
  user: AuthUserContext,
): Promise<{token: string; claims: AuthContextTokenClaims}> {
  const claims = buildAuthContextClaims(user);
  const signingKey = await getAuthPrivateSigningKey();

  const token = await new SignJWT(claims)
    .setProtectedHeader({
      alg: signingKey.alg,
      kid: signingKey.kid,
    })
    .setIssuer(getAuthJwtIssuer())
    .setAudience(getAuthJwtAudience())
    .setIssuedAt()
    .setSubject(user.id)
    .setExpirationTime(`${getAuthJwtTtlSeconds()}s`)
    .sign(signingKey.key);

  return {
    token,
    claims,
  };
}
