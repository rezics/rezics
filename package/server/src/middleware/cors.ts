import {
  corsPolicy,
  type CorsPolicyConfig,
  type CorsPolicyName,
} from '@package/cors';
import {TokenTransportHeader} from '@package/contract';
import {getProdState} from '../utils/getProdState';

const {isDev} = getProdState();

const devOrigins = [
  'http://localhost:35001',
  'http://localhost:35002',
  'http://localhost:8000',
];

const prodOrigins = ['https://book.rezics.com', 'https://rezics.com'];

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
    'accept',
    ...tokenHeaders,
  ],
  exposeHeaders: [
    TokenTransportHeader.REZICS_SESSION,
  ],
};

const publicCorsConfig: CorsPolicyConfig = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: [
    'content-type',
    'authorization',
    'accept',
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
    'accept',
    ...tokenHeaders,
  ],
  exposeHeaders: [],
};

export const serverConfigs: Record<CorsPolicyName, CorsPolicyConfig> = {
  credentialed: credentialedCorsConfig,
  public: publicCorsConfig,
  internal: internalCorsConfig,
};

export const serverCorsPolicy = (defaultPolicy: CorsPolicyName) =>
  corsPolicy(defaultPolicy, serverConfigs);
