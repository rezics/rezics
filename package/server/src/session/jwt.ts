import {jwt} from '@elysiajs/jwt';
import {createPrivateKey, createPublicKey, generateKeyPairSync} from 'node:crypto';
import type {KeyObject} from 'node:crypto';
import {
  NormalizedTokenName,
  TokenTransportHeader,
  type RezicsSessionTokenClaims,
  type TokenPermissionRole,
} from '@package/contract';
import {env} from '../env';

function normalizePem(value?: string): string | undefined {
  return value?.replace(/\\n/g, '\n');
}

function buildDevelopmentKeyPair(): {privateKey: KeyObject; publicKey: KeyObject} {
  return generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
}

const configuredPrivateKeyPem = normalizePem(env.MAIN_SESSION_JWT_PRIVATE_KEY);
const configuredPublicKeyPem = normalizePem(env.MAIN_SESSION_JWT_PUBLIC_KEY);

const runtimeKeyPair = configuredPrivateKeyPem
  ? {
      privateKey: createPrivateKey(configuredPrivateKeyPem),
      publicKey: configuredPublicKeyPem
        ? createPublicKey(configuredPublicKeyPem)
        : createPublicKey(configuredPrivateKeyPem),
    }
  : buildDevelopmentKeyPair();

if (env.NODE_ENV === 'production' && !configuredPrivateKeyPem) {
  throw new Error(
    'MAIN_SESSION_JWT_PRIVATE_KEY is required in production for main-server session signing',
  );
}

const mainSessionIssuer =
  env.MAIN_SESSION_JWT_ISSUER ?? `http://localhost:${env.PORT ?? '3000'}`;
const mainSessionAudience =
  env.MAIN_SESSION_JWT_AUDIENCE ?? 'rezics-main-server';
const mainSessionTtlSeconds = Number(env.MAIN_SESSION_JWT_TTL_SECONDS ?? '900');

export const mainSessionJwtPlugin = jwt({
  name: 'jwt',
  secret: runtimeKeyPair.privateKey,
  alg: 'ES256',
  iss: mainSessionIssuer,
  aud: mainSessionAudience,
  exp: `${mainSessionTtlSeconds}s`,
});

export function getMainSessionJwtContext() {
  return {
    issuer: mainSessionIssuer,
    audience: mainSessionAudience,
    ttlSeconds: mainSessionTtlSeconds,
    tokenName: NormalizedTokenName.REZICS_SESSION,
    verificationKey: runtimeKeyPair.publicKey,
  } as const;
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

export const REZICS_SESSION_HEADER =
  TokenTransportHeader.REZICS_SESSION;
