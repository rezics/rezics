import {cors} from '@elysiajs/cors';
import {Elysia} from 'elysia';
import {getProdState} from '../utils/getProdState';

const {isDev} = getProdState();

const devOrigins = [
  'http://localhost:35001',
  'http://localhost:35002',
  'http://localhost:8000',
];

const prodOrigins = ['https://book.rezics.com', 'https://rezics.com'];

export const allowedOrigins = isDev ? devOrigins : prodOrigins;

export const credentialedCorsConfig = {
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

export const publicCorsConfig = {
  origin: allowedOrigins,
  credentials: false,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposeHeaders: ['Content-Type'],
} as const;

export const internalCorsConfig = {
  origin: allowedOrigins,
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Requested-With',
    'x-auth_context_token',
    'x-rezics_session_token',
  ],
  exposeHeaders: ['Content-Type'],
} as const;

type CorsConfig =
  | typeof credentialedCorsConfig
  | typeof publicCorsConfig
  | typeof internalCorsConfig;
type CorsPolicyName = 'credentialed' | 'public' | 'internal';

type ElysiaApp = {
  use(plugin: unknown): unknown;
};

export function createCredentialedCors() {
  return cors({
    ...credentialedCorsConfig,
    methods: [...credentialedCorsConfig.methods],
    allowedHeaders: [...credentialedCorsConfig.allowedHeaders],
    exposeHeaders: [...credentialedCorsConfig.exposeHeaders],
  });
}

export function createPublicCors() {
  return cors({
    ...publicCorsConfig,
    methods: [...publicCorsConfig.methods],
    allowedHeaders: [...publicCorsConfig.allowedHeaders],
    exposeHeaders: [...publicCorsConfig.exposeHeaders],
  });
}

export function createInternalCors() {
  return cors({
    ...internalCorsConfig,
    methods: [...internalCorsConfig.methods],
    allowedHeaders: [...internalCorsConfig.allowedHeaders],
    exposeHeaders: [...internalCorsConfig.exposeHeaders],
  });
}

export function withCredentialedCors<T extends ElysiaApp>(app: T) {
  return app.use(createCredentialedCors()) as T;
}

export function withPublicCors<T extends ElysiaApp>(app: T) {
  return app.use(createPublicCors()) as T;
}

export function withInternalCors<T extends ElysiaApp>(app: T) {
  return app.use(createInternalCors()) as T;
}

function normalizeCorsResponse(response: unknown): Response {
  if (response instanceof Response) {
    return response;
  }

  if (typeof response === 'string') {
    return new Response(response);
  }

  return Response.json(response ?? null);
}

export function withCorsResponse(
  request: Request,
  response: unknown,
  corsConfig: CorsConfig,
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

export function createCorsPreflightResponse(
  request: Request,
  corsConfig: CorsConfig,
): Response {
  return withCorsResponse(request, new Response(null, {status: 204}), corsConfig);
}

function createCorsResponder(createPlugin: () => any) {
  return new Elysia()
    .use(createPlugin())
    .all('/*', () => new Response(null, {status: 204}));
}

const credentialedCorsResponder = createCorsResponder(createCredentialedCors);
const publicCorsResponder = createCorsResponder(createPublicCors);
const internalCorsResponder = createCorsResponder(createInternalCors);

function getCorsResponder(policy: CorsPolicyName) {
  switch (policy) {
    case 'public':
      return publicCorsResponder;
    case 'internal':
      return internalCorsResponder;
    default:
      return credentialedCorsResponder;
  }
}

function applyCorsHeaders(target: Headers, source: Headers) {
  for (const [key, value] of source.entries()) {
    if (key === 'vary' || key.startsWith('access-control-')) {
      target.set(key, value);
    }
  }
}

export async function withPolicyCorsResponse(
  request: Request,
  response: unknown,
  policy: CorsPolicyName,
): Promise<Response> {
  const next = normalizeCorsResponse(response);
  const corsResponse = await getCorsResponder(policy).handle(request);
  const headers = new Headers(next.headers);

  applyCorsHeaders(headers, corsResponse.headers);

  if (policy !== 'credentialed') {
    headers.delete('access-control-allow-credentials');
  }

  return new Response(next.body, {
    status: next.status,
    statusText: next.statusText,
    headers,
  });
}

export function createPolicyCorsPreflightResponse(
  request: Request,
  policy: CorsPolicyName,
) {
  return getCorsResponder(policy).handle(request);
}
