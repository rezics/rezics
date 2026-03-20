import {importPrivateJwk} from '@package/jwt';
import {
  authJwtPersistence,
  getLocalAuthJwtServiceRecord,
} from './prisma-adapter';
import {getAuthJwtIssuer} from './options';

export async function listAuthJwtKeys() {
  return authJwtPersistence.listKeys({issuer: getAuthJwtIssuer()});
}

export async function getLocalAuthJwtService() {
  return getLocalAuthJwtServiceRecord();
}

export async function getActiveAuthSigningKey() {
  const keys = await listAuthJwtKeys();
  const now = Date.now();
  const active = keys.find(
    key => key.expiresAt === null || key.expiresAt.getTime() > now,
  );

  if (!active) {
    throw new Error('Missing auth JWKS signing key');
  }

  return active;
}

export async function getAuthPrivateSigningKey() {
  const active = await getActiveAuthSigningKey();
  return {
    kid: active.kid,
    alg: active.algorithm,
    key: await importPrivateJwk(active.privateJwk),
  };
}

export async function getAuthPublicJwks() {
  const keys = await listAuthJwtKeys();
  const now = Date.now();
  const published = keys.filter(
    key => key.expiresAt === null || key.expiresAt.getTime() > now,
  );

  return {
    keys: published.map(key => key.publicJwk),
  };
}
