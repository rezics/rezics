import {prisma} from '@/prisma/client';
import {env} from '@/src/env';

export const serverJwtLocalServiceKey = 'server-local';
export const authJwtUpstreamServiceKey = 'auth-upstream';
export const serverSessionJwksPath = '/api/session/jwks';
export const authSessionJwksPath = '/api/auth/session/jwks';

function getServerBaseUrl() {
  return (
    env.MAIN_SESSION_JWT_ISSUER ?? `http://localhost:${env.PORT ?? '3000'}`
  );
}

export function getServerSessionJwtMetadata() {
  const issuer = getServerBaseUrl();
  const audience = env.MAIN_SESSION_JWT_AUDIENCE ?? 'rezics-main-server';

  return {
    serviceKey: serverJwtLocalServiceKey,
    issuer,
    audience,
    jwksUrl: new URL(serverSessionJwksPath, issuer).toString(),
    jwksPath: serverSessionJwksPath,
    isLocalIssuer: true,
    isActive: true,
  } as const;
}

export function getTrustedAuthJwtMetadata() {
  const issuer = env.AUTH_JWT_ISSUER ?? 'http://localhost:35003';
  const audience = env.AUTH_JWT_AUDIENCE ?? 'rezics-api';
  const jwksUrl =
    env.AUTH_JWKS_URL ?? new URL(authSessionJwksPath, issuer).toString();

  return {
    serviceKey: authJwtUpstreamServiceKey,
    issuer,
    audience,
    jwksUrl,
    jwksPath: authSessionJwksPath,
    isLocalIssuer: false,
    isActive: true,
  } as const;
}

function isMissingJwtMetadataStorage(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as {code?: string};
  return maybeError.code === 'P2021' || maybeError.code === 'P2022';
}

export async function ensureLocalServerJwtServiceRecord() {
  return prisma.jwtService.upsert({
    where: {
      serviceKey: serverJwtLocalServiceKey,
    },
    update: {},
    create: getServerSessionJwtMetadata(),
  });
}

export async function ensureTrustedAuthJwtServiceRecord() {
  try {
    const metadata = getTrustedAuthJwtMetadata();
    return await prisma.jwtService.upsert({
      where: {
        serviceKey: authJwtUpstreamServiceKey,
      },
      update: {},
      create: metadata,
    });
  } catch (error) {
    if (isMissingJwtMetadataStorage(error)) {
      const metadata = getTrustedAuthJwtMetadata();
      return {
        id: 'auth-upstream-bootstrap',
        ...metadata,
      };
    }
    throw error;
  }
}

export async function getTrustedAuthJwtServiceRecord() {
  return ensureTrustedAuthJwtServiceRecord();
}
