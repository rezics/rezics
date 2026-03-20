import {env} from '../../env';
import {JwtAlgorithm, type JwtIssuerDescriptor} from '@package/jwt';

export const authJwtLocalServiceKey = 'auth-local';

export function getAuthJwtAudience() {
  return env.AUTH_JWT_AUDIENCE ?? 'rezics-api';
}

export function getAuthJwtIssuer() {
  return env.AUTH_JWT_ISSUER ?? env.BETTER_AUTH_URL;
}

export function getAuthJwtTtlSeconds() {
  return Number(env.AUTH_JWT_TTL_SECONDS ?? '3600');
}

export function getAuthJwksRotationIntervalSeconds() {
  return Number(
    env.AUTH_JWKS_ROTATION_INTERVAL_SECONDS ?? `${90 * 24 * 60 * 60}`,
  );
}

export function getAuthJwksGracePeriodSeconds() {
  return Number(
    env.AUTH_JWKS_GRACE_PERIOD_SECONDS ?? `${getAuthJwtTtlSeconds() * 2}`,
  );
}

export function getAuthSessionJwksPath() {
  return `${env.AUTH_OPENAPI_ROUTER_PREFIX ?? '/api/auth'}/session/jwks`;
}

export function getAuthSessionJwksUrl() {
  return new URL(getAuthSessionJwksPath(), env.BETTER_AUTH_URL).toString();
}

export function getAuthJwtIssuerDescriptor(): JwtIssuerDescriptor {
  return {
    issuer: getAuthJwtIssuer(),
    audience: getAuthJwtAudience(),
    algorithm: JwtAlgorithm.ES256,
    jwksPath: getAuthSessionJwksPath(),
  };
}
