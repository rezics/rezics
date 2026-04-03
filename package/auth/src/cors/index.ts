import {
  corsPolicy,
  type CorsPolicyConfig,
  type CorsPolicyName,
} from '@rezics/cors';
import {TokenTransportHeader} from '@rezics/contract';
import {env} from '../env';

const devOrigins = [
  'http://localhost:35001',
  'http://localhost:35002',
  'http://localhost:8000',
];

const prodOrigins = ['https://book.rezics.com', 'https://rezics.com'];

const isDev = env.NODE_ENV === 'development';

export const allowedOrigins = isDev ? devOrigins : prodOrigins;

const tokenHeaders = [
  TokenTransportHeader.AUTH_CONTEXT,
  TokenTransportHeader.REZICS_SESSION,
  TokenTransportHeader.NOTIFICATION_SESSION,
  TokenTransportHeader.SEARCH_SESSION,
];

const credentialedCorsConfig: CorsPolicyConfig = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'content-type',
    'authorization',
    'x-internal-auth-token',
    ...tokenHeaders,
  ],
  exposeHeaders: [],
};

const publicCorsConfig: CorsPolicyConfig = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'content-type',
    'authorization',
    ...tokenHeaders,
  ],
  exposeHeaders: [],
};

const internalCorsConfig: CorsPolicyConfig = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'content-type',
    'authorization',
    'x-internal-auth-token',
    ...tokenHeaders,
  ],
  exposeHeaders: [],
};

export const authConfigs: Record<CorsPolicyName, CorsPolicyConfig> = {
  credentialed: credentialedCorsConfig,
  public: publicCorsConfig,
  internal: internalCorsConfig,
};

export const authCorsPolicy = (defaultPolicy: CorsPolicyName) =>
  corsPolicy(defaultPolicy, authConfigs);
