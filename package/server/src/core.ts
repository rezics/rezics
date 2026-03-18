import {Elysia} from 'elysia';
import {mainSessionJwtPlugin} from './session/jwt';
import {getProdState} from './utils/getProdState';

const {isDev} = getProdState();

const devOrigins = [
  'http://localhost:35001',
  'http://localhost:35002',
  'http://localhost:8000',
];

const prodOrigins = ['https://book.rezics.com', 'https://rezics.com'];

export const allowedOrigins = isDev ? devOrigins : prodOrigins;
export const serverCredentialedCorsConfig = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Requested-With',
    'x-auth_context_token',
    'x-rezics_session_token',
  ],
  exposeHeaders: [
    'Content-Type',
    'Authorization',
    'x-rezics_session_token',
  ],
} as const;

export const serverPublicCorsConfig = {
  origin: allowedOrigins,
  credentials: false,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposeHeaders: ['Content-Type'],
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

export function withServerCorsResponse(
  request: Request,
  response: unknown,
  corsConfig = serverCredentialedCorsConfig,
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
  headers.set(
    'access-control-expose-headers',
    corsConfig.exposeHeaders.join(', '),
  );

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

export function createServerCorsPreflightResponse(
  request: Request,
  corsConfig = serverCredentialedCorsConfig,
): Response {
  return withServerCorsResponse(
    request,
    new Response(null, {status: 204}),
    corsConfig,
  );
}

function getServerCorsConfig(pathname: string) {
  if (pathname.endsWith('/session/jwks')) {
    return serverPublicCorsConfig;
  }

  return serverCredentialedCorsConfig;
}

export function coreInstance(
  prefix: string,
  corsConfig?: typeof serverCredentialedCorsConfig,
) {
  return new Elysia({prefix})
    .use(mainSessionJwtPlugin)
    .options('/*', ({request}) =>
      createServerCorsPreflightResponse(
        request,
        corsConfig ?? getServerCorsConfig(new URL(request.url).pathname),
      ),
    )
    .onAfterHandle(({request, response}) =>
      withServerCorsResponse(
        request,
        response,
        corsConfig ?? getServerCorsConfig(new URL(request.url).pathname),
      ),
    );
}

export type coreApp = ReturnType<typeof coreInstance>;
