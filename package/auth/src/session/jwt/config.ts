import {env} from '../../env';
import {JwtAlgorithm, type JwtIssuerDescriptor} from '@package/jwt';

export const authJwtLocalServiceKey = 'auth-local';

function getRuntimeEnv(name: keyof NodeJS.ProcessEnv, fallback?: string) {
  return process.env[name] ?? fallback;
}

export function getAuthJwtAudience() {
  return getRuntimeEnv('AUTH_JWT_AUDIENCE', env.AUTH_JWT_AUDIENCE) ?? 'rezics-api';
}

export function getAuthJwtIssuer() {
  return (
    getRuntimeEnv('AUTH_JWT_ISSUER', env.AUTH_JWT_ISSUER) ??
    getRuntimeEnv('BETTER_AUTH_URL', env.BETTER_AUTH_URL)
  );
}

export function getAuthJwtTtlSeconds() {
  return Number(getRuntimeEnv('AUTH_JWT_TTL_SECONDS', env.AUTH_JWT_TTL_SECONDS) ?? '3600');
}

export function getAuthJwksRotationIntervalSeconds() {
  return Number(
    getRuntimeEnv(
      'AUTH_JWKS_ROTATION_INTERVAL_SECONDS',
      env.AUTH_JWKS_ROTATION_INTERVAL_SECONDS,
    ) ?? `${90 * 24 * 60 * 60}`,
  );
}

export function getAuthJwksGracePeriodSeconds() {
  return Number(
    getRuntimeEnv(
      'AUTH_JWKS_GRACE_PERIOD_SECONDS',
      env.AUTH_JWKS_GRACE_PERIOD_SECONDS,
    ) ?? `${getAuthJwtTtlSeconds() * 2}`,
  );
}

export function getAuthSessionJwksPath() {
  return `${
    getRuntimeEnv('AUTH_OPENAPI_ROUTER_PREFIX', env.AUTH_OPENAPI_ROUTER_PREFIX) ??
    '/api/auth'
  }/session/jwks`;
}

export function getAuthSessionJwksUrl() {
  return new URL(
    getAuthSessionJwksPath(),
    getRuntimeEnv('BETTER_AUTH_URL', env.BETTER_AUTH_URL),
  ).toString();
}

export function getAuthJwtIssuerDescriptor(): JwtIssuerDescriptor {
  return {
    issuer: getAuthJwtIssuer(),
    audience: getAuthJwtAudience(),
    algorithm: JwtAlgorithm.ES256,
    jwksPath: getAuthSessionJwksPath(),
  };
}
