import {Elysia} from 'elysia';
import {env} from './env';

const devOrigins = [
  'http://localhost:35001',
  'http://localhost:35002',
  'http://localhost:8000',
];
const prodOrigins = ['https://book.rezics.com', 'https://rezics.com'];

const isDev = env.NODE_ENV === 'development';

export const allowedOrigins = isDev ? devOrigins : prodOrigins;
export const authCredentialedCorsConfig = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'content-type',
    'authorization',
    'x-internal-auth-token',
  ],
} as const;

export const authPublicCorsConfig = {
  origin: allowedOrigins,
  credentials: false,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['content-type', 'authorization'],
} as const;

function normalizeCorsResponse(response: unknown): Response {
  if (response instanceof Response) {
    return response;
  }

  if (typeof response === 'string') {
    return new Response(response);
  }

  return Response.json(response ?? null);
}

export function withAuthCorsResponse(
  request: Request,
  response: unknown,
  corsConfig = authCredentialedCorsConfig,
): Response {
  const next = normalizeCorsResponse(response);
  const headers = new Headers(next.headers);
  const origin = request.headers.get('origin');

  if (origin && corsConfig.origin.includes(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'Origin');
  }

  headers.set('access-control-allow-methods', corsConfig.methods.join(', '));
  headers.set(
    'access-control-allow-headers',
    corsConfig.allowedHeaders.join(', '),
  );

  if ('exposeHeaders' in corsConfig && corsConfig.exposeHeaders) {
    headers.set(
      'access-control-expose-headers',
      corsConfig.exposeHeaders.join(', '),
    );
  }

  if (corsConfig.credentials) {
    headers.set('access-control-allow-credentials', 'true');
  } else {
    headers.delete('access-control-allow-credentials');
  }

  return new Response(next.body, {
    status: next.status,
    statusText: next.statusText,
    headers,
  });
}

export function createAuthCorsPreflightResponse(
  request: Request,
  corsConfig = authCredentialedCorsConfig,
): Response {
  return withAuthCorsResponse(request, new Response(null, {status: 204}), corsConfig);
}

function getAuthCorsConfig(pathname: string) {
  if (
    pathname.endsWith('/session/jwks') ||
    pathname.includes('/oauth/') ||
    pathname.endsWith('/providers') ||
    pathname.includes('/.well-known/') ||
    pathname.includes('/callback/') ||
    pathname.endsWith('/sign-in/social')
  ) {
    return authPublicCorsConfig;
  }

  return authCredentialedCorsConfig;
}

export function coreInstance(
  prefix = '',
  corsConfig?: typeof authCredentialedCorsConfig,
) {
  return new Elysia({prefix})
    .options('/*', ({request}) =>
      createAuthCorsPreflightResponse(
        request,
        corsConfig ?? getAuthCorsConfig(new URL(request.url).pathname),
      ),
    )
    .onAfterHandle(({request, response}) =>
      withAuthCorsResponse(
        request,
        response,
        corsConfig ?? getAuthCorsConfig(new URL(request.url).pathname),
      ),
    );
}

export type CoreApp = ReturnType<typeof coreInstance>;
