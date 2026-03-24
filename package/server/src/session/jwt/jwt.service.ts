import {Elysia} from 'elysia';
import {
  asJwtPrivateJwk,
  createRotationEngine,
  defaultJwtCryptoProvider,
  importPrivateJwk,
  JwtAlgorithm,
  verifySessionToken,
} from '@package/jwt';
import {
  NormalizedTokenName,
  TokenTransportHeader,
  type RezicsSessionTokenClaims,
  type TokenPermissionRole,
} from '@package/contract';
import {SignJWT} from 'jose';
import {serverJwtPersistence} from './jwt-persistence';
import {getJwtService} from '@/jwt';
import {env} from '@/env';

function getMainSessionJwtTtlSeconds() {
  return Number(env.MAIN_SESSION_JWT_TTL_SECONDS ?? '900');
}

let mainSessionRotationPromise: Promise<
  ReturnType<typeof createRotationEngine>
> | null = null;

async function getMainSessionRotation() {
  if (!mainSessionRotationPromise) {
    mainSessionRotationPromise = (async () => {
      const service = await getJwtService('server-local');
      const rotation = createRotationEngine({
        issuer: {
          issuer: service.issuer,
          audience: service.audience,
          algorithm: JwtAlgorithm.ES256,
          jwksPath: service.jwksPath,
        },
        config: {
          tokenTtlMs: getMainSessionJwtTtlSeconds() * 1000,
        },
        persistence: serverJwtPersistence,
        cryptoProvider: defaultJwtCryptoProvider,
      });

      await rotation.ensureActiveKey();
      return rotation;
    })();
  }

  return mainSessionRotationPromise;
}

export const mainSessionJwtPlugin = new Elysia({
  name: '@rezics/main-session-jwt',
}).decorate('jwt', {
  async sign(
    signValue: Record<string, unknown> & {
      aud?: string | string[];
      iss?: string;
      jti?: string;
      sub?: string;
      nbf?: string | number;
      exp?: string | number;
      iat?: boolean;
    },
  ) {
    const service = await getJwtService('server-local');
    const rotation = await getMainSessionRotation();
    const activeKey = await rotation.getActiveSigningKey();
    const signingKey = await importPrivateJwk(
      asJwtPrivateJwk(
        service.jwks[0]?.privateJwk ?? activeKey.privateJwk,
      ),
    );
    const {nbf, exp, iat, aud, iss, jti, sub, ...data} = signValue;

    let token = new SignJWT({
      ...data,
      ...(jti ? {jti} : {}),
      ...(sub ? {sub} : {}),
    })
      .setProtectedHeader({
        alg: activeKey.algorithm,
        kid: activeKey.kid,
        typ: 'JWT',
      })
      .setIssuer(iss ?? service.issuer)
      .setAudience(aud ?? service.audience);

    if (nbf !== undefined) token = token.setNotBefore(nbf);
    token =
      exp !== undefined
        ? token.setExpirationTime(exp)
        : token.setExpirationTime(`${getMainSessionJwtTtlSeconds()}s`);
    if (iat !== false) token = token.setIssuedAt(new Date());
    if (sub) token = token.setSubject(sub);
    if (jti) token = token.setJti(jti);

    return token.sign(signingKey);
  },
  async verify(token: string | undefined) {
    if (!token) return false;

    try {
      const context = await getMainSessionJwtContext();
      return (
        await verifySessionToken(token, {
          ...context,
          clockToleranceSeconds: 5,
        })
      ).payload;
    } catch {
      return false;
    }
  },
});

export async function getMainSessionJwtContext() {
  const service = await getJwtService('server-local');

  return {
    issuer: service.issuer,
    audience: service.audience,
    algorithm: JwtAlgorithm.ES256,
    ttlSeconds: getMainSessionJwtTtlSeconds(),
    tokenName: NormalizedTokenName.REZICS_SESSION,
    jwks: {
      keys: service.jwks.map(k => k.publicJwk),
    },
  } as const;
}

export async function getMainSessionPublicJwks() {
  const service = await getJwtService('server-local');
  return {
    keys: service.jwks.map(k => k.publicJwk),
  };
}

function hasRole(
  roles: string[] | undefined,
  role: TokenPermissionRole,
): boolean {
  return Boolean(roles?.includes(role));
}

export function resolveMainSessionRole(
  roles: string[] | undefined,
): TokenPermissionRole {
  if (hasRole(roles, 'BLOCKED')) return 'BLOCKED';
  if (hasRole(roles, 'ROOT')) return 'ROOT';
  if (hasRole(roles, 'ADMIN')) return 'ADMIN';
  return 'USER';
}

export function buildRezicsSessionClaims(input: {
  unitId: string;
  roles?: string[];
}): Omit<RezicsSessionTokenClaims, 'exp' | 'iat' | 'iss' | 'aud'> {
  return {
    unitId: input.unitId,
    permission: {
      role: resolveMainSessionRole(input.roles),
    },
  };
}

export const REZICS_SESSION_HEADER = TokenTransportHeader.REZICS_SESSION;
