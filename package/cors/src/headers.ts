import type {CorsPolicyConfig} from './types';

export function applyHeaders(
  request: Request,
  headers: Headers,
  config: CorsPolicyConfig,
): void {
  const origin = request.headers.get('origin');

  if (origin && config.origin.includes(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'Origin');
  }

  headers.set('access-control-allow-methods', config.methods.join(', '));
  headers.set(
    'access-control-allow-headers',
    config.allowedHeaders.join(', '),
  );

  if (config.exposeHeaders.length > 0) {
    headers.set(
      'access-control-expose-headers',
      config.exposeHeaders.join(', '),
    );
  } else {
    headers.delete('access-control-expose-headers');
  }

  if (config.credentials) {
    headers.set('access-control-allow-credentials', 'true');
  } else {
    headers.delete('access-control-allow-credentials');
  }
}

/**
 * Apply CORS headers to a plain header record (Elysia `set.headers`).
 * Use this in app-level `onError` handlers where the `Headers` API is not
 * available.
 */
export function applyCorsToSet(
  request: Request,
  setHeaders: Record<string, string | undefined>,
  config: CorsPolicyConfig,
): void {
  const origin = request.headers.get('origin');
  if (origin && config.origin.includes(origin)) {
    setHeaders['access-control-allow-origin'] = origin;
    setHeaders['vary'] = 'Origin';
  }
  setHeaders['access-control-allow-methods'] = config.methods.join(', ');
  setHeaders['access-control-allow-headers'] =
    config.allowedHeaders.join(', ');
  if (config.exposeHeaders.length > 0) {
    setHeaders['access-control-expose-headers'] =
      config.exposeHeaders.join(', ');
  }
  if (config.credentials) {
    setHeaders['access-control-allow-credentials'] = 'true';
  }
}

export function preflightResponse(
  request: Request,
  config: CorsPolicyConfig,
): Response {
  const headers = new Headers();
  applyHeaders(request, headers, config);
  headers.set('access-control-max-age', '600');
  return new Response(null, {status: 204, headers});
}
