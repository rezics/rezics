import {Elysia} from 'elysia';
import {createPrivateKey, createPublicKey} from 'node:crypto';
import {
  createRotationEngine,
  defaultJwtCryptoProvider,
  JwtAlgorithm,
  verifySessionToken,
  type JwtCryptoProvider,
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

function normalizePem(value?: string): string | undefined {
  return value?.replace(/\\n/g, '\n');
}

function createSeededCryptoProvider(): JwtCryptoProvider {
  const privateKeyPem = normalizePem(process.env.MAIN_SESSION_JWT_PRIVATE_KEY);
  const publicKeyPem = normalizePem(process.env.MAIN_SESSION_JWT_PUBLIC_KEY);
  let seeded = false;

  return {
    generateKey() {
      if (privateKeyPem && !seeded) {
        seeded = true;

        return {
          privateKeyPem,
          publicKeyPem:
            publicKeyPem ??
            createPublicKey(privateKeyPem)
              .export({format: 'pem', type: 'spki'})
              .toString(),
        };
      }

      return defaultJwtCryptoProvider.generateKey();
    },
  };
}

function getMainSessionJwtTtlSeconds() {
  return Number(process.env.MAIN_SESSION_JWT_TTL_SECONDS ?? '900');
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

    return token.sign(createPrivateKey(activeKey.privateKeyPem));
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
