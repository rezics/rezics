import {
  corsPolicy,
  type CorsPolicyConfig,
  type CorsPolicyName,
} from '@package/cors';
import {getProdState} from '../utils/getProdState';

const {isDev} = getProdState();

const devOrigins = [
  'http://localhost:35001',
  'http://localhost:35002',
  'http://localhost:8000',
];

const prodOrigins = ['https://book.rezics.com', 'https://rezics.com'];

export const allowedOrigins = isDev ? devOrigins : prodOrigins;

const credentialedCorsConfig: CorsPolicyConfig = {
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
};

const publicCorsConfig: CorsPolicyConfig = {
  origin: allowedOrigins,
  credentials: false,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposeHeaders: ['Content-Type'],
};

const internalCorsConfig: CorsPolicyConfig = {
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
};

const serverConfigs: Record<CorsPolicyName, CorsPolicyConfig> = {
  credentialed: credentialedCorsConfig,
  public: publicCorsConfig,
  internal: internalCorsConfig,
};

export const serverCorsPolicy = (defaultPolicy: CorsPolicyName) =>
  corsPolicy(defaultPolicy, serverConfigs);
