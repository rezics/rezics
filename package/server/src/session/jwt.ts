import {Elysia} from 'elysia';
import {
  asJwtPrivateJwk,
  asJwtPublicJwk,
  createRotationEngine,
  defaultJwtCryptoProvider,
  importPrivateJwk,
  JwtAlgorithm,
  verifySessionToken,
  type JwtCryptoProvider,
  type JwtPrivateJwk,
  type JwtPublicJwk,
} from '@package/jwt';
import {
  NormalizedTokenName,
  TokenTransportHeader,
  type RezicsSessionTokenClaims,
  type TokenPermissionRole,
} from '@package/contract';
import {SignJWT} from 'jose';
import {serverJwtPersistence} from './jwt-persistence';
import {getServerSessionJwtMetadata, serverSessionJwksPath} from './jwt-metadata';
import {env} from '../env';

function parseSeededJwk<TJwk extends JwtPublicJwk | JwtPrivateJwk>(
  value: string | undefined,
): TJwk | null {
  if (!value) {
    return null;
  }

  return JSON.parse(value) as TJwk;
}

function createSeededCryptoProvider(): JwtCryptoProvider {
  const privateJwk = parseSeededJwk<JwtPrivateJwk>(
    env.MAIN_SESSION_JWT_PRIVATE_JWK,
  );
  const publicJwk = parseSeededJwk<JwtPublicJwk>(
    env.MAIN_SESSION_JWT_PUBLIC_JWK,
  );
  let seeded = false;

  return {
    generateKey() {
      if (privateJwk && publicJwk && !seeded) {
        seeded = true;

        return {
          privateJwk: asJwtPrivateJwk(privateJwk),
          publicJwk: asJwtPublicJwk(publicJwk),
        };
      }

      return defaultJwtCryptoProvider.generateKey();
    },
  };
}

function getMainSessionJwtTtlSeconds() {
  return Number(env.MAIN_SESSION_JWT_TTL_SECONDS ?? '900');
}

const mainSessionMetadata = getServerSessionJwtMetadata();
let mainSessionRotationPromise:
  | Promise<
      ReturnType<typeof createRotationEngine>
    >
  | null = null;

async function getMainSessionRotation() {
  if (!mainSessionRotationPromise) {
    mainSessionRotationPromise = (async () => {
      const rotation = createRotationEngine({
        issuer: {
          issuer: mainSessionMetadata.issuer,
          audience: mainSessionMetadata.audience,
          algorithm: JwtAlgorithm.ES256,
          jwksPath: serverSessionJwksPath,
        },
        config: {
          tokenTtlMs: getMainSessionJwtTtlSeconds() * 1000,
        },
        persistence: serverJwtPersistence,
        cryptoProvider: createSeededCryptoProvider(),
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
    const rotation = await getMainSessionRotation();
    const activeKey = await rotation.getActiveSigningKey();
    const signingKey = await importPrivateJwk(activeKey.privateJwk);
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
      .setIssuer(iss ?? mainSessionMetadata.issuer)
      .setAudience(aud ?? mainSessionMetadata.audience);

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
  const rotation = await getMainSessionRotation();

  return {
    issuer: mainSessionMetadata.issuer,
    audience: mainSessionMetadata.audience,
    algorithm: JwtAlgorithm.ES256,
    ttlSeconds: getMainSessionJwtTtlSeconds(),
    tokenName: NormalizedTokenName.REZICS_SESSION,
    jwks: await rotation.getPublicJwks(),
  } as const;
}

export async function getMainSessionPublicJwks() {
  return (await getMainSessionRotation()).getPublicJwks();
}

function hasRole(roles: string[] | undefined, role: TokenPermissionRole): boolean {
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
