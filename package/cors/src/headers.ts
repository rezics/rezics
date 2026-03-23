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

export function preflightResponse(
  request: Request,
  config: CorsPolicyConfig,
): Response {
  const headers = new Headers();
  applyHeaders(request, headers, config);
  headers.set('access-control-max-age', '600');
  return new Response(null, {status: 204, headers});
}
