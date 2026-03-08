import {Elysia} from 'elysia';
import {cors} from '@elysiajs/cors';
import {env} from './env';

const devOrigins = [
  'http://localhost:35001',
  'http://localhost:35002',
  'http://localhost:8000',
];
const prodOrigins = ['https://book.rezics.com', 'https://rezics.com'];

const isDev = env.NODE_ENV === 'development';

export const allowedOrigins = isDev ? devOrigins : prodOrigins;

export function coreInstance(prefix = '') {
  return new Elysia({prefix}).use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'content-type',
        'authorization',
        'x-internal-auth-token',
      ],
    }),
  );
}

export type CoreApp = ReturnType<typeof coreInstance>;
