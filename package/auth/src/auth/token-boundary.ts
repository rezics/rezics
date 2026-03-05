import {env} from '../env';
import {AuthPolicyError} from './errors';

function parseHostFromOrigin(origin: string | null): string | null {
  if (!origin) {
    return null;
  }

  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

export function enforceInternalTokenSurface(request: Request): void {
  const {pathname} = new URL(request.url);

  if (!pathname.startsWith('/api/auth/token')) {
    return;
  }

  const internalSecret = request.headers.get('x-internal-auth-token');
  if (internalSecret !== env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET) {
    throw new AuthPolicyError(
      403,
      'AUTH_TOKEN_SURFACE_BLOCKED',
      'Token endpoint is restricted to internal callers',
    );
  }

  const expectedHost = new URL(env.BETTER_AUTH_URL).host;
  const refererHost = parseHostFromOrigin(request.headers.get('referer'));
  const originHost = parseHostFromOrigin(request.headers.get('origin'));

  const hostMismatch =
    (refererHost && refererHost !== expectedHost) ||
    (originHost && originHost !== expectedHost);

  if (hostMismatch) {
    throw new AuthPolicyError(
      403,
      'AUTH_TOKEN_ORIGIN_MISMATCH',
      'Token endpoint origin policy rejected request',
    );
  }
}
