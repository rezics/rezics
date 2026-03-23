import {
  corsPolicy,
  type CorsPolicyConfig,
  type CorsPolicyName,
} from '@package/cors';
import {env} from '../env';

const devOrigins = [
  'http://localhost:35001',
  'http://localhost:35002',
  'http://localhost:8000',
];

const prodOrigins = ['https://book.rezics.com', 'https://rezics.com'];

const isDev = env.NODE_ENV === 'development';

export const allowedOrigins = isDev ? devOrigins : prodOrigins;

const credentialedCorsConfig: CorsPolicyConfig = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'content-type',
    'authorization',
    'x-internal-auth-token',
  ],
  exposeHeaders: [],
};

const publicCorsConfig: CorsPolicyConfig = {
  origin: allowedOrigins,
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['content-type', 'authorization'],
  exposeHeaders: [],
};

const internalCorsConfig: CorsPolicyConfig = {
  origin: allowedOrigins,
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'content-type',
    'authorization',
    'x-internal-auth-token',
  ],
  exposeHeaders: [],
};

const authConfigs: Record<CorsPolicyName, CorsPolicyConfig> = {
  credentialed: credentialedCorsConfig,
  public: publicCorsConfig,
  internal: internalCorsConfig,
};

export const authCorsPolicy = (defaultPolicy: CorsPolicyName) =>
  corsPolicy(defaultPolicy, authConfigs);
